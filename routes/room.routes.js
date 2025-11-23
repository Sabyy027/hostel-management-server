import express from 'express';
import Room from '../models/Room.model.js';
import Floor from '../models/Floor.model.js'; // We need this
import Block from '../models/Block.model.js'; // We need this
import authMiddleware from '../middleware/auth.middleware.js';

const router = express.Router();
const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
  next();
};

// --- 1. GET FULL HOSTEL STRUCTURE (NEW) ---
router.get('/structure', authMiddleware, async (req, res) => {
  try {
    const blocks = await Block.find().sort({ name: 1 });
    const floors = await Floor.find().sort({ number: -1 });
    const rooms = await Room.find();

    // This is complex, but it builds the nested structure
    // that the frontend needs
    const structure = blocks.map(block => {
      // Find floors for this block
      const blockFloors = floors
        .filter(f => f.block.toString() === block._id.toString())
        .map(floor => {
          // Find rooms for this floor
          const floorRooms = rooms.filter(r => r.floor.toString() === floor._id.toString());
          return { ...floor.toObject(), rooms: floorRooms };
        });
      return { ...block.toObject(), floors: blockFloors };
    });
    
    res.json(structure);
  } catch (error) {
    console.error("Error building structure:", error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// --- 2. ADD A ROOM (Now uses floorId) ---
router.post('/add', [authMiddleware, adminOnly], async (req, res) => {
  const { 
    floorId, roomNumber, capacity, type, pricePerYear, 
    isStaffRoom, staffRole, otherStaffDetails 
  } = req.body;

  try {
    // --- AUTOMATIC BATHROOM LOGIC ---
    // If type is AC, bathroom is Attached. Otherwise, Common.
    const bathroomType = type === 'AC' ? 'Attached' : 'Common';
    // --------------------------------

    const newRoom = new Room({
      floor: floorId,
      roomNumber,
      capacity,
      type,
      bathroomType, // <--- Save this to DB
      pricePerYear,
      isStaffRoom,
      staffRole: isStaffRoom ? staffRole : null,
      otherStaffDetails: (isStaffRoom && staffRole === 'Other') ? otherStaffDetails : ''
    });

    await newRoom.save();
    res.status(201).json(newRoom);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: `Room ${roomNumber} already exists.` });
    }
    res.status(500).json({ message: 'Server error creating room.' });
  }
});

// --- 3. DELETE A ROOM ---
router.delete('/:id', [authMiddleware, adminOnly], async (req, res) => {
  try {
    await Room.findByIdAndDelete(req.params.id);
    res.json({ message: 'Room deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting room' });
  }
});

export default router;