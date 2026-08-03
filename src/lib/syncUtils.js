import { collection, getDocs, writeBatch, doc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

/**
 * Creates a deterministic, safe document ID from an employee name.
 */
const getEmployeeId = (name) => {
  return (name || '').trim().toLowerCase().replace(/[^a-z0-9а-яіїєґ]/gi, '_');
};

export const triggerGlobalSync = async () => {
  try {
    const [projSnapshot, empSnapshot, absSnapshot] = await Promise.all([
      getDocs(collection(db, 'projects')),
      getDocs(collection(db, 'employees')),
      getDocs(collection(db, 'absences'))
    ]);

    const projects = projSnapshot.docs.map(d => d.data());
    const employees = empSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

    const diagnostics = {
      projectsFound: projects.length,
      employeesBefore: employees.length,
      uniqueNames: 0,
      added: 0,
      deleted: 0,
      migrated: 0
    };

    if (projects.length === 0) {
      console.warn('No projects found in DB. Skipping employee removal to prevent roster wipe.');
      return { success: true, diagnostics, warning: 'No projects found' };
    }

    // Group active employee names by department ('design' vs 'construction')
    const activeEmpMap = new Map(); // key: nameLower + '_' + dept -> { originalName, dept }
    const activeKeysSet = new Set();

    projects.forEach(p => {
      const empName = (p.assignedEmployee || '').trim();
      if (!empName || empName === 'Не призначено') return;
      const dept = p.department || 'design';
      const nameLower = empName.toLowerCase();
      const comboKey = `${nameLower}_${dept}`;

      if (!activeEmpMap.has(comboKey)) {
        activeEmpMap.set(comboKey, { originalName: empName, dept });
      }
      activeKeysSet.add(comboKey);
    });

    diagnostics.uniqueNames = activeEmpMap.size;
    const empBatch = writeBatch(db);
    let changed = false;

    // 1. Add/Update employees per department with safe deterministic IDs
    activeEmpMap.forEach(({ originalName, dept }, comboKey) => {
      const customId = getEmployeeId(`${originalName}_${dept}`);
      const ref = doc(db, 'employees', customId);
      const roleName = dept === 'construction' ? 'Конструктор' : 'Проєктант';

      const existingEmp = employees.find(e => e.id === customId || ( (e.name || '').trim().toLowerCase() === originalName.toLowerCase() && (e.department || 'design') === dept ));

      if (!existingEmp || existingEmp.id !== customId || existingEmp.department !== dept) {
        empBatch.set(ref, { 
          name: originalName, 
          role: roleName,
          department: dept,
          updatedAt: serverTimestamp() 
        }, { merge: true });
        changed = true;
        diagnostics.added++;
      }
    });

    // 2. Remove stale employees no longer present in any projects for their department
    employees.forEach(emp => {
      const empNameLower = (emp.name || '').trim().toLowerCase();
      const empDept = emp.department || 'design';
      const comboKey = `${empNameLower}_${empDept}`;
      const deterministicId = getEmployeeId(`${emp.name}_${empDept}`);

      const isStale = !activeKeysSet.has(comboKey);
      const isLegacyDuplicate = activeKeysSet.has(comboKey) && emp.id !== deterministicId;

      if (isStale || isLegacyDuplicate) {
        empBatch.delete(doc(db, 'employees', emp.id));
        diagnostics.deleted++;

        if (isStale) {
          absSnapshot.docs.forEach(absDoc => {
            if (absDoc.data().employeeId === emp.id) {
              empBatch.delete(doc(db, 'absences', absDoc.id));
            }
          });
        } else if (isLegacyDuplicate) {
          absSnapshot.docs.forEach(absDoc => {
            if (absDoc.data().employeeId === emp.id) {
              empBatch.update(doc(db, 'absences', absDoc.id), {
                employeeId: deterministicId
              });
              diagnostics.migrated++;
            }
          });
        }

        changed = true;
      }
    });

    if (changed) {
      await empBatch.commit();
    }
    
    return { success: true, diagnostics };
  } catch (err) {
    console.error('Sync error:', err);
    return { success: false, error: err.message };
  }
};
