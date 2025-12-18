# MongoDB Setup Guide

## Option 1: MongoDB Atlas (Cloud - Recommended) 🌟

### Step 1: Create MongoDB Atlas Account
1. Go to https://www.mongodb.com/cloud/atlas/register
2. Sign up for a free account (no credit card required for free tier)

### Step 2: Create a Cluster
1. After signing in, click "Build a Database"
2. Choose the **FREE** (M0) tier
3. Select a cloud provider and region (choose closest to you)
4. Click "Create Cluster" (takes 3-5 minutes)

### Step 3: Create Database User
1. Go to "Database Access" in the left sidebar
2. Click "Add New Database User"
3. Choose "Password" authentication
4. Enter a username and generate a secure password (SAVE THIS!)
5. Set user privileges to "Atlas admin" or "Read and write to any database"
6. Click "Add User"

### Step 4: Configure Network Access
1. Go to "Network Access" in the left sidebar
2. Click "Add IP Address"
3. For development, click "Allow Access from Anywhere" (0.0.0.0/0)
   - ⚠️ For production, only add specific IPs
4. Click "Confirm"

### Step 5: Get Connection String
1. Go to "Database" → "Connect"
2. Choose "Connect your application"
3. Select "Node.js" and version "5.5 or later"
4. Copy the connection string (looks like: `mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/`)
5. Replace `<password>` with your database user password
6. Replace `<dbname>` with `chat-system` (or your preferred database name)

### Step 6: Update .env.local
Update your `.env.local` file:
```
MONGODB_URI=mongodb+srv://yourusername:yourpassword@cluster0.xxxxx.mongodb.net/chat-system?retryWrites=true&w=majority
```

---

## Option 2: Local MongoDB Installation

### Install MongoDB on macOS (using Homebrew)

1. **Install Homebrew** (if not already installed):
   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```

2. **Install MongoDB Community Edition**:
   ```bash
   brew tap mongodb/brew
   brew install mongodb-community
   ```

3. **Start MongoDB Service**:
   ```bash
   brew services start mongodb-community
   ```

4. **Verify MongoDB is Running**:
   ```bash
   brew services list
   # Should show mongodb-community as "started"
   ```

5. **Test Connection**:
   ```bash
   mongosh
   # Should connect to MongoDB shell
   ```

6. **Update .env.local**:
   ```
   MONGODB_URI=mongodb://localhost:27017/chat-system
   ```

### Stop MongoDB (when needed):
```bash
brew services stop mongodb-community
```

### Start MongoDB (when needed):
```bash
brew services start mongodb-community
```

---

## Test Your Connection

After setting up either option, test the connection:

1. Make sure your `.env.local` has the correct `MONGODB_URI`
2. Start your development server:
   ```bash
   npm run dev
   ```
3. Check the console - you should see: `✅ MongoDB connected`
4. Try registering a user via the API to test the connection

---

## Troubleshooting

### MongoDB Atlas Connection Issues:
- Make sure your IP is whitelisted in Network Access
- Verify the password in the connection string is correct
- Check that the cluster is fully created (not still provisioning)

### Local MongoDB Issues:
- Verify MongoDB is running: `brew services list`
- Check MongoDB logs: `tail -f /usr/local/var/log/mongodb/mongo.log`
- Try restarting: `brew services restart mongodb-community`


