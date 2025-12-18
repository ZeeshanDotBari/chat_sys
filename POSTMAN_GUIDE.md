# Postman Collection Guide

## Import the Collection

1. Open Postman
2. Click **Import** button (top left)
3. Select the file: `Chat-System-API.postman_collection.json`
4. Click **Import**

## Setup Environment Variables

The collection uses the following variables:

- `base_url` - Default: `http://localhost:3000`
- `accessToken` - Automatically set after login
- `refreshToken` - Automatically set after login
- `userId` - Automatically set after login
- `chatId` - Automatically set after creating a chat

### To Set Variables Manually:

1. Click on the collection name
2. Go to **Variables** tab
3. Update `base_url` if your server runs on a different port

## Quick Start Workflow

### 1. Register a New User
- Use **Authentication > Register**
- Update the request body with your desired username, email, and password
- Send the request
- Copy the `accessToken` and `refreshToken` from the response

### 2. Login (Alternative)
- Use **Authentication > Login**
- The collection automatically saves tokens to environment variables
- This is the recommended way as it auto-saves tokens

### 3. Get Current User
- Use **Users > Get Current User**
- This will use the saved `accessToken` automatically

### 4. Search Users
- Use **Users > Search Users**
- Update the query parameter `q` with your search term

### 5. Create a Chat
- Use **Chats > Create Chat**
- Update the `participants` array with user IDs
- The `chatId` will be automatically saved

### 6. Get Messages
- Use **Chats > Get Chat Messages**
- The `chatId` variable will be used automatically

## Features

### Auto-Save Tokens
The following requests automatically save tokens to environment variables:
- **Login** - Saves `accessToken`, `refreshToken`, and `userId`
- **Refresh Token** - Updates `accessToken`
- **Create Chat** - Saves `chatId`

### Pre-configured Headers
All authenticated requests include the `Authorization` header with the `accessToken` automatically.

## Request Examples

### Register Request Body:
```json
{
  "username": "johndoe",
  "email": "john.doe@example.com",
  "password": "password123"
}
```

### Login Request Body:
```json
{
  "email": "john.doe@example.com",
  "password": "password123"
}
```

### Create Direct Chat:
```json
{
  "participants": ["userId1"],
  "type": "direct"
}
```

### Create Group Chat:
```json
{
  "participants": ["userId1", "userId2"],
  "type": "group",
  "name": "My Group Chat",
  "description": "This is a group chat"
}
```

## Testing Tips

1. **Always start with Register or Login** to get your tokens
2. **Use the Login endpoint** as it auto-saves tokens (recommended)
3. **Check the environment variables** after login to verify tokens are saved
4. **Use the saved `chatId`** for subsequent chat-related requests
5. **Update query parameters** in the URL for search and pagination

## Troubleshooting

### 401 Unauthorized
- Make sure you've logged in and the token is saved
- Try refreshing your token using **Authentication > Refresh Token**

### 404 Not Found
- Verify the `base_url` is correct
- Make sure your server is running on the specified port

### Variables Not Updating
- Check that the test scripts are enabled in Postman settings
- Manually update variables in the collection variables tab


