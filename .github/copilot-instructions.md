# Copilot Instructions for VJ-Hostels

## Project Overview
The VJ-Hostels project is a comprehensive hostel management system with three main components:
- **Admin Client**: React-based web application for hostel administrators.
- **Student Client**: React-based web application for students.
- **Server**: Node.js/Express backend with MongoDB for data storage.

## Key Architectural Patterns
- **Frontend**:
  - Modular structure with reusable components in `src/components`.
  - State management using React Context API in `src/context`.
  - Routing handled by React Router in `src/pages`.
  - ESLint rules defined in `eslint.config.js`.
- **Backend**:
  - API route handlers in `server/APIs`.
  - Mongoose models in `server/models`.
  - Middleware in `server/middleware`.
  - Configuration files in `server/config`.

## Developer Workflows
### Build and Run
- **Frontend**:
  - Start development server: `npm run dev` (port 3201).
  - Build for production: `npm run build`.
- **Backend**:
  - Start development server: `npm run dev`.
  - Start production server: `npm start`.

### Testing
- **Backend**:
  - Run tests: `npm test`.
  - Watch mode: `npm run test:watch`.
- **Frontend**:
  - Lint code: `npm run lint`.

### Data Seeding
- Seed OTP data: `npm run seed`.
- Import mock users: `npm run import:mockusers`.
- Allocate rooms: `npm run allocate:rooms`.

## Project-Specific Conventions
- **Frontend**:
  - Use `react-hook-form` for form handling.
  - Follow the ESLint rules defined in `eslint.config.js`.
  - Use `axios` for API requests.
- **Backend**:
  - Use `express-async-handler` for error handling in routes.
  - Precompute summaries in MongoDB documents to minimize runtime computation.
  - Use `dotenv` for environment variable management.

## Integration Points
- **Frontend-Backend Communication**:
  - API base URL: `http://localhost:6201` (development).
  - Proxy setup in `vite.config.js` to avoid CORS issues.
- **External Services**:
  - Cloudinary for file uploads.
  - Twilio for SMS services.

## Examples
### MongoDB Schema Example
```javascript
const attendanceSchema = new mongoose.Schema({
  student_id: { type: String, required: true },
  year: { type: Number, required: true },
  month: { type: Number, required: true },
  attendance: { type: Map, of: String },
  summary: {
    present: { type: Number, default: 0 },
    absent: { type: Number, default: 0 },
    home_pass: { type: Number, default: 0 }
  }
});
```

### API Route Example
```javascript
adminApp.get('/get-complaints', verifyAdmin, expressAsyncHandler(async (req, res) => {
  const complaints = await Complaint.find().sort({ createdAt: -1 });
  res.status(200).json(complaints);
}));
```

## Notes
- Follow the folder structure and naming conventions strictly.
- Minimize database reads/writes by leveraging precomputed fields and efficient queries.
- Use the provided scripts for data seeding and testing to ensure consistency.

For further details, refer to the `README.md` files in the root and `frontend/` directories.