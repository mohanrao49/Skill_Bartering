# Skill Bartering Platform

A web-based platform where users can exchange skills instead of money. Users list skills they OFFER and skills they WANT, and the system performs bidirectional matching to suggest potential skill swaps.

## 🎯 Project Overview

This is a Final Year Project for Computer Science/Engineering. The platform facilitates skill exchange between users through a structured swap system with session scheduling, resource sharing, progress tracking, and internal chat features.

## 🛠️ Tech Stack

### Frontend
- **React** 18.2.0 (Web only - no mobile app)
- **HTML, CSS, JavaScript**
- **React Router** for navigation
- **Axios** for API calls

### Backend
- **Node.js** + **Express.js**
- **SQLite** database (`.db` file only - NO MongoDB)
- **JWT** for authentication
- **bcryptjs** for password hashing

## 📁 Project Structure

```
Skill_Bartering/
├── backend/
│   ├── database/
│   │   ├── init.js          # Database initialization
│   │   ├── db.js            # Database connection
│   │   └── skill_swap.db    # SQLite database (created on first run)
│   ├── middleware/
│   │   └── auth.js          # JWT authentication middleware
│   ├── routes/
│   │   ├── auth.js          # Authentication routes
│   │   ├── users.js         # User profile routes
│   │   ├── skills.js        # Skills CRUD routes
│   │   ├── matching.js      # Skill matching logic
│   │   ├── swapRequests.js  # Swap request management
│   │   ├── swapSessions.js  # Active swap sessions
│   │   ├── learningSessions.js  # Learning session scheduling
│   │   ├── resources.js     # Resource sharing
│   │   ├── messages.js      # Internal chat
│   │   ├── reviews.js       # Reviews and ratings
│   │   └── admin.js         # Admin panel routes
│   ├── scripts/
│   │   └── seed.js          # Seed data script
│   ├── server.js            # Express server
│   └── package.json
│
└── frontend/
    ├── public/
    │   └── index.html
    ├── src/
    │   ├── components/
    │   │   ├── Navbar.js
    │   │   └── PrivateRoute.js
    │   ├── context/
    │   │   └── AuthContext.js
    │   ├── pages/
    │   │   ├── Login.js
    │   │   ├── Register.js
    │   │   ├── Dashboard.js
    │   │   ├── Profile.js
    │   │   ├── SwapRequests.js
    │   │   ├── ActiveSwap.js
    │   │   ├── Reviews.js
    │   │   └── AdminPanel.js
    │   ├── App.js
    │   ├── App.css
    │   ├── index.js
    │   └── index.css
    └── package.json
```

## 🚀 Setup Instructions

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file (optional - defaults provided):
```bash
cp .env.example .env
```

Edit `.env` and set:
```
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
PORT=5000
```

4. Initialize database (this creates the SQLite database and tables):
```bash
npm start
```

The database will be created automatically on first run.

5. (Optional) Seed sample data:
```bash
npm run seed
```

This creates:
- Admin user: `admin@skillswap.com` / `password123`
- 4 sample users with skills and swaps
- Sample swap requests and active swaps

6. Start the backend server:
```bash
npm start
# or for development with auto-reload:
npm run dev
```

Backend runs on `http://localhost:5000`

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm start
```

Frontend runs on `http://localhost:3000`

## 📊 Database Schema

The SQLite database includes the following tables:

- **users** - User accounts with profile information
- **skills** - Skills offered/wanted by users
- **swap_requests** - Swap request tracking
- **swap_sessions** - Active swap sessions
- **sessions** - Learning sessions within active swaps
- **resources** - Shared resources (links, notes, PDFs)
- **messages** - Chat messages within active swaps
- **reviews** - Reviews and ratings after swap completion

All tables use foreign keys for data integrity.

## 🔑 Key Features

### 1. Authentication
- User registration and login
- JWT-based authentication
- Protected routes

### 2. User Module
- Profile management (bio, rating)
- Add/edit/delete skills
- Skills can be marked as OFFER or WANT

### 3. Skill Matching
- **Bidirectional matching**: User A wants what User B offers AND User B wants what User A offers
- Only then a swap is suggested
- Matches displayed on dashboard

### 4. Swap Request Flow
- Send swap request to matched users
- Accept/reject requests
- On accept → swap becomes ACTIVE

### 5. Active Swap Features
Once a swap becomes ACTIVE, users can:

- **Session Scheduling**: Schedule learning sessions (Online/Offline)
- **Resource Sharing**: Share links, notes, PDFs
- **Progress Tracking**: Mark sessions as completed, track hours
- **Internal Chat**: Text-based chat per active swap

### 6. Completion & Review
- Mark swap as completed
- Leave mutual ratings (1-5 stars)
- Reviews update user reputation scores

### 7. Admin Module
- Admin login
- View all users
- View all swaps
- Cancel swaps (dispute resolution)
- Platform statistics

## 🔄 Application Flow

1. **Registration/Login** → User creates account
2. **Add Skills** → User adds skills they OFFER and WANT
3. **Matching** → System finds bidirectional matches
4. **Request Swap** → User sends swap request to matched user
5. **Accept Request** → Receiver accepts → Swap becomes ACTIVE
6. **Active Swap** → Users schedule sessions, share resources, chat
7. **Complete Swap** → Users mark swap as completed
8. **Review** → Users leave ratings and feedback

## 🧪 Testing the Application

### Sample Accounts (after seeding):

1. **Admin:**
   - Email: `admin@skillswap.com`
   - Password: `password123`

2. **User 1 (John):**
   - Email: `john@example.com`
   - Password: `password123`
   - Offers: JavaScript, Python
   - Wants: Graphic Design, Photography

3. **User 2 (Jane):**
   - Email: `jane@example.com`
   - Password: `password123`
   - Offers: Graphic Design, UI/UX Design
   - Wants: JavaScript, Spanish

4. **User 3 (Mike):**
   - Email: `mike@example.com`
   - Password: `password123`
   - Offers: Photography, Photo Editing
   - Wants: JavaScript

5. **User 4 (Sarah):**
   - Email: `sarah@example.com`
   - Password: `password123`
   - Offers: Spanish, French
   - Wants: Graphic Design

### Example Flow:

1. Login as `john@example.com`
2. Go to Dashboard → See Jane as a match (John wants Graphic Design, Jane wants JavaScript)
3. Click "Request Swap"
4. Login as `jane@example.com`
5. Go to Swap Requests → Accept the request
6. Swap becomes active → Both users can now schedule sessions, share resources, and chat

## 📝 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user (protected)

### Users
- `GET /api/users/:id` - Get user profile
- `PUT /api/users/:id` - Update user profile
- `GET /api/users` - Get all users (admin only)

### Skills
- `GET /api/skills` - Get all skills
- `GET /api/skills/user/:userId` - Get user's skills
- `POST /api/skills` - Add skill
- `PUT /api/skills/:id` - Update skill
- `DELETE /api/skills/:id` - Delete skill

### Matching
- `GET /api/matching/matches` - Get matched users
- `GET /api/matching/details/:matchedUserId` - Get detailed match info

### Swap Requests
- `GET /api/swap-requests` - Get swap requests
- `POST /api/swap-requests` - Create swap request
- `POST /api/swap-requests/:id/accept` - Accept request
- `POST /api/swap-requests/:id/reject` - Reject request

### Swap Sessions
- `GET /api/swap-sessions` - Get active swaps
- `GET /api/swap-sessions/:id` - Get swap details
- `POST /api/swap-sessions/:id/complete` - Complete swap

### Learning Sessions
- `POST /api/learning-sessions` - Create session
- `GET /api/learning-sessions/swap/:swapSessionId` - Get sessions
- `PUT /api/learning-sessions/:id` - Update session status

### Resources
- `POST /api/resources` - Add resource
- `GET /api/resources/swap/:swapSessionId` - Get resources
- `DELETE /api/resources/:id` - Delete resource

### Messages
- `POST /api/messages` - Send message
- `GET /api/messages/swap/:swapSessionId` - Get messages

### Reviews
- `POST /api/reviews` - Submit review
- `GET /api/reviews/user/:userId` - Get user reviews
- `GET /api/reviews/swap/:swapSessionId` - Get swap reviews

### Admin
- `GET /api/admin/stats` - Platform statistics
- `GET /api/admin/users` - All users
- `GET /api/admin/swap-requests` - All swap requests
- `GET /api/admin/swap-sessions` - All swap sessions
- `POST /api/admin/swap-sessions/:id/cancel` - Cancel swap

## 🎓 Viva Defense Points

1. **Unique Concept**: Bidirectional skill matching ensures both parties benefit
2. **Complete Flow**: Registration → Matching → Request → Active Swap → Completion → Review
3. **Proper Database Design**: Normalized schema with foreign keys
4. **Security**: JWT authentication, password hashing, protected routes
5. **Real-world Features**: Session scheduling, resource sharing, chat, reviews
6. **Admin Panel**: Complete admin functionality for platform management
7. **Code Quality**: Well-commented, organized, RESTful APIs

## 📚 Additional Notes

- The platform **does NOT teach directly** - it **facilitates** teaching between users
- All teaching happens through scheduled sessions, shared resources, and chat
- Users track their own progress by marking sessions as completed
- Rating system ensures quality and builds user reputation

## 🐛 Troubleshooting

1. **Database errors**: Delete `backend/database/skill_swap.db` and restart server
2. **Port already in use**: Change PORT in `.env` or kill process using port 5000/3000
3. **CORS errors**: Ensure backend CORS middleware is enabled
4. **Authentication errors**: Check JWT_SECRET matches between .env files

## 📄 License

This project is for educational purposes (Final Year Project).

## 👨‍💻 Author

Final Year Project - Skill Bartering Platform

---

**Note**: This is a web-only application. No mobile app version is included as per requirements.

# Skill_Bartering
