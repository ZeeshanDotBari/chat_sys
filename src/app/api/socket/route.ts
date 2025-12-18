// This route is used for Socket.io initialization
// The actual Socket.io server is initialized in a custom server file
export async function GET() {
  return Response.json({ message: 'Socket.io endpoint' });
}


