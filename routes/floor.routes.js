import express from 'express';
import Floor from '../models/Floor.model.js';
import Room from '../models/Room.model.js';
import User from '../models/User.model.js';
import authMiddleware from '../middleware/auth.middleware.js';

const router = express.Router();
const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin only' });
  }
  next();
};

// --- 1. GET ALL FLOORS FOR A SPECIFIC BLOCK ---
router.get('/block/:blockId', authMiddleware, async (req, res) => {
  try {
    const floors = await Floor.find({ block: req.params.blockId }).sort({ number: -1 });
    res.json(floors);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});


// --- 3. DELETE A FLOOR (and all its rooms) ---
router.delete('/:id', [authMiddleware, adminOnly], async (req, res) => {
  try {
    const floor = await Floor.findById(req.params.id);
    if (!floor) return res.status(404).json({ message: 'Floor not found' });
    
    // Delete all rooms on this floor
    await Room.deleteMany({ floor: floor._id });
    
    // Delete the floor itself
    await floor.deleteOne();
    
    res.json({ message: 'Floor and all associated rooms deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/auto-generate', [authMiddleware, adminOnly], async (req, res) => {
  // Expecting: { blockId, batches: [ { count: 3, type: 'AC' }, { count: 3, type: 'Non-AC' } ] }
  const { blockId, batches } = req.body; 
  
  if (!blockId || !batches || !Array.isArray(batches)) {
    return res.status(400).json({ message: 'Invalid data' });
  }

  try {
    const floorsToCreate = [];
    let currentFloorNumber = 1; // Start counting from Floor 1

    // Loop through each "Batch" the user defined
    for (const batch of batches) {
      const count = parseInt(batch.count);
      if (!count || count < 1) continue;

      // Create floors for this batch
      for (let i = 0; i < count; i++) {
        floorsToCreate.push({
          name: `Floor ${currentFloorNumber}`,
          number: currentFloorNumber,
          block: blockId,
          type: batch.type, // 'AC' or 'Non-AC'
          // Logic: AC floors usually have 0 common toilets (attached), Non-AC have 2
          commonToilets: batch.type === 'AC' ? 0 : 2 
        });
        currentFloorNumber++; // Increment for the next floor
      }
    }

    // Bulk Insert
    await Floor.insertMany(floorsToCreate, { ordered: true }).catch(err => {
        if (err.code !== 11000 && err.writeErrors?.some(e => e.code !== 11000)) throw err;
    });

    res.status(201).json({ message: `Generated ${floorsToCreate.length} floors successfully.` });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error generating floors' });
  }
});

// --- 4. ASSIGN RT TO FLOOR (Admin Only) - POST version (body contains floorId) ---
router.post('/assign-rt', [authMiddleware, adminOnly], async (req, res) => {
  const { floorId, rtId } = req.body;
  
  try {
    const floor = await Floor.findById(floorId);
    if (!floor) return res.status(404).json({ message: 'Floor not found' });

    // If unassigning (rtId is null or empty)
    if (!rtId || rtId === '') {
      // Remove floor from previous RT's assignedFloors
      if (floor.assignedRT) {
        await User.findByIdAndUpdate(floor.assignedRT, {
          $pull: { assignedFloors: floor._id }
        });
      }
      floor.assignedRT = null;
      await floor.save();
      return res.json({ message: 'RT unassigned from floor', floor });
    }

    // Verify the user is an RT
    const rt = await User.findById(rtId);
    if (!rt || rt.designation !== 'Resident Tutor') {
      return res.status(400).json({ message: 'Selected user is not a Resident Tutor' });
    }

    // Remove floor from previous RT if exists
    if (floor.assignedRT && floor.assignedRT.toString() !== rtId) {
      await User.findByIdAndUpdate(floor.assignedRT, {
        $pull: { assignedFloors: floor._id }
      });
    }

    // Assign new RT to floor
    floor.assignedRT = rtId;
    await floor.save();

    // Add floor to RT's assignedFloors (if not already present)
    await User.findByIdAndUpdate(rtId, {
      $addToSet: { assignedFloors: floor._id }
    });

    const updatedFloor = await Floor.findById(floor._id).populate('assignedRT', 'username email');
    res.json({ message: 'RT assigned successfully', floor: updatedFloor });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error assigning RT' });
  }
});

// --- 5. UNASSIGN RT FROM FLOOR (Admin Only) ---
router.delete('/unassign-rt/:floorId', [authMiddleware, adminOnly], async (req, res) => {
  try {
    const floor = await Floor.findById(req.params.floorId);
    if (!floor) return res.status(404).json({ message: 'Floor not found' });

    // Remove floor from RT's assignedFloors
    if (floor.assignedRT) {
      await User.findByIdAndUpdate(floor.assignedRT, {
        $pull: { assignedFloors: floor._id }
      });
    }

    floor.assignedRT = null;
    await floor.save();

    res.json({ message: 'RT unassigned from floor successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error unassigning RT' });
  }
});

// --- 6. GET FLOOR ASSIGNMENTS (Admin Only) ---
router.get('/assignments', [authMiddleware, adminOnly], async (req, res) => {
  try {
    const floors = await Floor.find({ assignedRT: { $ne: null } })
      .populate('assignedRT', 'username email designation')
      .select('_id name number assignedRT');
    
    const assignments = floors.map(f => ({
      floor: f._id,
      floorName: f.name,
      floorNumber: f.number,
      rt: f.assignedRT?._id,
      rtName: f.assignedRT?.username,
      rtEmail: f.assignedRT?.email
    }));

    res.json(assignments);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching assignments' });
  }
});

// --- 7. ASSIGN RT TO FLOOR (Admin Only) - PUT version (floorId in path) ---
router.put('/assign-rt/:floorId', [authMiddleware, adminOnly], async (req, res) => {
  const { rtId } = req.body; // Can be null to unassign
  
  try {
    const floor = await Floor.findById(req.params.floorId);
    if (!floor) return res.status(404).json({ message: 'Floor not found' });

    // If unassigning (rtId is null or empty)
    if (!rtId || rtId === '') {
      // Remove floor from previous RT's assignedFloors
      if (floor.assignedRT) {
        await User.findByIdAndUpdate(floor.assignedRT, {
          $pull: { assignedFloors: floor._id }
        });
      }
      floor.assignedRT = null;
      await floor.save();
      return res.json({ message: 'RT unassigned from floor', floor });
    }

    // Verify the user is an RT
    const rt = await User.findById(rtId);
    if (!rt || rt.designation !== 'Resident Tutor') {
      return res.status(400).json({ message: 'Selected user is not a Resident Tutor' });
    }

    // Remove floor from previous RT if exists
    if (floor.assignedRT && floor.assignedRT.toString() !== rtId) {
      await User.findByIdAndUpdate(floor.assignedRT, {
        $pull: { assignedFloors: floor._id }
      });
    }

    // Assign new RT to floor
    floor.assignedRT = rtId;
    await floor.save();

    // Add floor to RT's assignedFloors (if not already present)
    await User.findByIdAndUpdate(rtId, {
      $addToSet: { assignedFloors: floor._id }
    });

    const updatedFloor = await Floor.findById(floor._id).populate('assignedRT', 'username email');
    res.json({ message: 'RT assigned successfully', floor: updatedFloor });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error assigning RT' });
  }
});

export default router;