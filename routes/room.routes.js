import express from "express";
import Room from "../models/Room.model.js";
import Floor from "../models/Floor.model.js"; // We need this
import Block from "../models/Block.model.js"; // We need this
import User from "../models/User.model.js"; // For RT filtering
import authMiddleware, { managerOnly, adminOnly } from "../middleware/auth.middleware.js";
import Discount from '../models/Discount.model.js';

const router = express.Router();

// --- 1. GET FULL HOSTEL STRUCTURE (NEW) ---
router.get('/structure', authMiddleware, async (req, res) => {
  try {
    const blocks = await Block.find().sort({ name: 1 });
    
    // Fetch floors and populate assignedRT
    let floors = await Floor.find().populate('assignedRT', 'username email designation').sort({ number: -1 });
    
    // Filter floors for RTs - they should only see their assigned floors
    const rtUser = await User.findById(req.user.userId);
    if (rtUser && rtUser.role === 'rt') {
      if (rtUser.assignedFloors && rtUser.assignedFloors.length > 0) {
        const assignedFloorIds = rtUser.assignedFloors.map(id => id.toString());
        floors = floors.filter(f => assignedFloorIds.includes(f._id.toString()));
      } else {
        // If RT has no assigned floors, show nothing
        floors = [];
      }
    }
    
    // POPULATE THE DISCOUNT FIELD HERE
    const rooms = await Room.find().populate('activeDiscount'); 

    const structure = blocks.map(block => {
      const blockFloors = floors
        .filter(f => f.block.toString() === block._id.toString())
        .map(floor => {
          const floorRooms = rooms.filter(r => r.floor.toString() === floor._id.toString());
          return { ...floor.toObject(), rooms: floorRooms };
        });
      return { ...block.toObject(), floors: blockFloors };
    });
    
    res.json(structure);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// --- 2. ADD A ROOM (Now uses floorId) ---
router.post("/add", [authMiddleware, adminOnly], async (req, res) => {
  const {
    floorId,
    roomNumber,
    capacity,
    type,
    pricingPlans, // <--- NEW: Expect an array of plans
    isStaffRoom,
    staffRole,
    otherStaffDetails,
  } = req.body;

  try {
    // --- AUTOMATIC BATHROOM LOGIC ---
    // If type is AC, bathroom is Attached. Otherwise, Common.
    const bathroomType = type === "AC" ? "Attached" : "Common";
    // --------------------------------

    const newRoom = new Room({
      floor: floorId,
      roomNumber,
      capacity,
      type,
      bathroomType,
      pricingPlans, // <--- Save the array
      isStaffRoom,
      staffRole: isStaffRoom ? staffRole : null,
      otherStaffDetails:
        isStaffRoom && staffRole === "Other" ? otherStaffDetails : "",
    });

    await newRoom.save();
    res.status(201).json(newRoom);
  } catch (error) {
    if (error.code === 11000) {
      return res
        .status(400)
        .json({ message: `Room ${roomNumber} already exists.` });
    }
    res.status(500).json({ message: "Server error creating room." });
  }
});
// --- NEW: BULK CREATE ROOMS ---
router.post('/bulk-create', [authMiddleware, adminOnly], async (req, res) => {
  const { 
    floorId, 
    startNumber, // e.g. 101
    endNumber,   // e.g. 110
    capacity, 
    type, 
    pricingPlans,
    isStaffRoom, 
    staffRole 
  } = req.body;

  try {
    const roomsToCreate = [];
    const start = parseInt(startNumber);
    const end = parseInt(endNumber);
    
    const bathroomType = type === 'AC' ? 'Attached' : 'Common';

    for (let i = start; i <= end; i++) {
      roomsToCreate.push({
        floor: floorId,
        roomNumber: i.toString(), // e.g. "101", "102"
        capacity,
        type,
        bathroomType,
        pricingPlans,
        isStaffRoom: isStaffRoom || false,
        staffRole: isStaffRoom ? staffRole : null
      });
    }

    // Use insertMany with ordered: false to skip duplicates without crashing
    await Room.insertMany(roomsToCreate, { ordered: false }).catch(err => {
       // Ignore duplicate key errors (E11000)
       if (err.code !== 11000 && err.writeErrors?.some(e => e.code !== 11000)) throw err;
    });

    res.status(201).json({ message: `Bulk creation process completed for ${roomsToCreate.length} rooms.` });

  } catch (error) {
    console.error("Bulk Create Error:", error);
    res.status(500).json({ message: 'Server error during bulk creation' });
  }
});

// --- 3. DELETE A ROOM ---
router.delete("/:id", [authMiddleware, adminOnly], async (req, res) => {
  try {
    await Room.findByIdAndDelete(req.params.id);
    res.json({ message: "Room deleted" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting room" });
  }
});

router.put('/apply-discount/:roomId', [authMiddleware, adminOnly], async (req, res) => {
  const { discountId } = req.body; // Send null to remove discount
  try {
    const room = await Room.findByIdAndUpdate(
      req.params.roomId, 
      { activeDiscount: discountId },
      { new: true }
    ).populate('activeDiscount');
    
    res.json({ message: 'Discount Updated', room });
  } catch (error) {
    res.status(500).json({ message: 'Error applying discount' });
  }
});

export default router;
