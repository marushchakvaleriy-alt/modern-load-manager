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

    const uniqueNamesFromProjects = new Set(
      projects.map(p => (p.assignedEmployee || '').trim()).filter(Boolean).map(n => n.toLowerCase())
    );
    diagnostics.uniqueNames = uniqueNamesFromProjects.size;

    const empBatch = writeBatch(db);
    let changed = false;

    // 1. Add/Update employees using deterministic IDs
    uniqueNamesFromProjects.forEach(nameLower => {
      const originalName = projects.find(p => (p.assignedEmployee || '').trim().toLowerCase() === nameLower)?.assignedEmployee?.trim();
      if (originalName) {
        const customId = getEmployeeId(originalName);
        const ref = doc(db, 'employees', customId);
        
        const existingEmp = employees.find(e => (e.name || '').trim().toLowerCase() === nameLower);
        
        if (!existingEmp || existingEmp.id !== customId) {
          empBatch.set(ref, { 
            name: originalName, 
            role: 'Проєктант', 
            updatedAt: serverTimestamp() 
          }, { merge: true });
          changed = true;
          diagnostics.added++;
        }
      }
    });

    // 2. Remove stale employees OR legacy random-ID duplicates
    employees.forEach(emp => {
      const empNameLower = (emp.name || '').trim().toLowerCase();
      const deterministicId = getEmployeeId(emp.name);
      
      const isStale = !uniqueNamesFromProjects.has(empNameLower);
      const isLegacyDuplicate = uniqueNamesFromProjects.has(empNameLower) && emp.id !== deterministicId;

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
