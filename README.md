# Secure Chat Application

A full-stack secure chat application built with Node.js, Express, MongoDB, React, and Vite.

## Project Structure

```
├── backend/
│   ├── config/
│   │   └── database.js
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── messageController.js
│   │   └── userController.js
│   ├── models/
│   │   ├── User.js
│   │   └── Message.js
│   ├── middleware/
│   │   └── auth.js
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── messageRoutes.js
│   │   └── userRoutes.js
│   ├── services/
│   ├── .env.example
│   ├── .gitignore
│   ├── package.json
│   └── server.js
│
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── MessageBubble.jsx
    │   │   └── ProtectedRoute.jsx
    │   ├── pages/
    │   │   ├── Login.jsx
    │   │   ├── Register.jsx
    │   │   └── ChatDashboard.jsx
    │   ├── services/
    │   │   └── api.js
    │   ├── App.jsx
    │   ├── index.css
    │   └── main.jsx
    ├── .gitignore
    ├── index.html
    ├── package.json
    ├── postcss.config.js
    ├── tailwind.config.js
    └── vite.config.js
```

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (local or Atlas)
- npm or yarn

## Backend Setup

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Environment Configuration

Create a `.env` file in the backend directory:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/secure-chat
JWT_SECRET=your_secure_jwt_secret_key_here
NODE_ENV=development
```

### 3. MongoDB Setup

If using MongoDB locally:

```bash
# On Windows
net start MongoDB

# On macOS
brew services start mongodb-community

# On Linux
sudo systemctl start mongod
```

Or use MongoDB Atlas (cloud):

- Create a free account at https://www.mongodb.com/cloud/atlas
- Create a cluster and get your connection string
- Update `MONGODB_URI` in `.env`

### 4. Start Backend Server

```bash
# Production
npm start

# Development with auto-reload
npm run dev
```

Backend will run on `http://localhost:5000`

## Frontend Setup

### 1. Install Dependencies

```bash
cd frontend
npm install
```

### 2. Start Development Server

```bash
npm run dev
```

Frontend will run on `http://localhost:3000`

### 3. Build for Production

```bash
npm run build
```

Output will be in the `dist/` directory

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user

### Users

- `GET /api/users` - Get all users
- `GET /api/users/stats` - Get current user stats
- `PUT /api/users/status` - Update user online status

### Messages

- `POST /api/messages/send` - Send a message
- `GET /api/messages/:userId` - Get messages with a user
- `PATCH /api/messages/:messageId/read` - Mark message as read

## Features

- User Authentication (Register/Login)
- Real-time user status
- Send and receive messages
- Message read status
- User online/offline status
- Responsive design with Tailwind CSS
- Protected routes
- JWT-based authentication

## Testing the Application

### 1. Create Test Users

Visit `http://localhost:3000/register` and create 2-3 accounts:

- User 1: `john@example.com` / `password123`
- User 2: `jane@example.com` / `password123`
- User 3: `bob@example.com` / `password123`

### 2. Login and Chat

- Login with one account
- Select another user from the sidebar
- Send messages
- Logout and login with another account to see the conversation

## Security Features

✓ Password hashing with bcryptjs
✓ JWT token authentication
✓ Protected API routes
✓ Input validation
✓ CORS enabled
✓ Environment variables for sensitive data

## Future Enhancements

- [ ] Real-time chat with Socket.io
- [ ] Message encryption
- [ ] File sharing
- [ ] Group chats
- [ ] Message search
- [ ] User profiles
- [ ] Typing indicators
- [ ] Message reactions

## Troubleshooting

### MongoDB Connection Error

- Ensure MongoDB is running
- Check `MONGODB_URI` in `.env`
- Verify network connectivity if using Atlas

### Port Already in Use

```bash
# Change port in backend: update PORT in .env
# Change port in frontend: update port in vite.config.js
```

### CORS Errors

- Ensure backend server is running
- Check frontend proxy configuration in `vite.config.js`

## Contributing

Feel free to fork and create pull requests.

## License

ISC
