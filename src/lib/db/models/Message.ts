import mongoose, { Schema, Document } from 'mongoose';

export interface IMessage extends Document {
  _id: mongoose.Types.ObjectId;
  chat: mongoose.Types.ObjectId;
  sender: mongoose.Types.ObjectId;
  content: string;
  type: 'text' | 'image' | 'file';
  readBy: mongoose.Types.ObjectId[];
  // File metadata (for file/image messages)
  fileName?: string;
  fileSize?: number;
  fileUrl?: string;
  fileType?: string;
  // Encryption fields
  isEncrypted?: boolean;
  encryptedData?: string; // Base64 encrypted message
  encryptedKey?: string; // Base64 encrypted AES key (for recipient)
  iv?: string; // Base64 initialization vector
  senderContent?: string; // Original plaintext content (for sender to view their own messages)
  // Deletion tracking
  deletedForEveryone?: boolean;
  deletedFor?: mongoose.Types.ObjectId[];
  // Reply reference
  replyTo?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    chat: {
      type: Schema.Types.ObjectId,
      ref: 'Chat',
      required: true,
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    content: {
      type: String,
      required: [true, 'Message content is required'],
      trim: true,
    },
    type: {
      type: String,
      enum: ['text', 'image', 'file'],
      default: 'text',
    },
    readBy: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    // File metadata - explicitly defined (optional fields)
    fileName: {
      type: String,
    },
    fileSize: {
      type: Number,
    },
    fileUrl: {
      type: String,
    },
    fileType: {
      type: String,
    },
    // Encryption fields
    isEncrypted: {
      type: Boolean,
      default: false,
    },
    encryptedData: {
      type: String,
    },
    encryptedKey: {
      type: String,
    },
    iv: {
      type: String,
    },
    senderContent: {
      type: String,
    },
    // Deletion tracking
    deletedForEveryone: {
      type: Boolean,
      default: false,
    },
    deletedFor: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    // Reply reference
    replyTo: {
      type: Schema.Types.ObjectId,
      ref: 'Message',
    },
  },
  {
    timestamps: true,
    strict: true, // Ensure strict mode is enabled
  }
);

MessageSchema.index({ chat: 1, createdAt: -1 });

// Clear the model cache if it exists to ensure schema changes are applied
if (mongoose.models.Message) {
  delete mongoose.models.Message;
}

export default mongoose.model<IMessage>('Message', MessageSchema);


