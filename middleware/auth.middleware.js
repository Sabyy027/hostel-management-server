import jwt from 'jsonwebtoken';

const authMiddleware = (req, res, next) => {
  // 1. Get the token from the request header
  // Tokens are usually sent in the format: "Bearer <token>"
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Access denied. No token provided.' });
  }

  const token = authHeader.split(' ')[1]; // Get just the token part

  try {
    // 2. Verify the token
    const decodedPayload = jwt.verify(token, process.env.JWT_SECRET);

    // 3. Attach the user's info to the request object
    // We can now access `req.user` in any protected route
    req.user = { 
      userId: decodedPayload.userId, 
      username: decodedPayload.username, 
      role: decodedPayload.role
    };
    
    // 4. Pass control to the next function (the route handler)
    next();

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token.' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token has expired.' });
    }
    res.status(500).json({ message: 'Server error during token validation.' });
  }
};

// Middleware for routes accessible by both Admin and Warden
export const managerOnly = (req, res, next) => {
  if (req.user.role === 'admin' || req.user.role === 'warden') {
    next();
  } else {
    return res.status(403).json({ message: 'Access denied. Managers only.' });
  }
};

// Middleware for routes accessible ONLY by Admin
export const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied. Admin only.' });
  }
  next();
};

export default authMiddleware;