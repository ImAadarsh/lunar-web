export type ShiftChatStatus = "upcoming" | "active" | "closed";

export type ShiftChatThread = {
  id: number;
  shiftId: number;
  userId: number;
  guardName: string;
  siteId: number;
  siteName: string;
  status: ShiftChatStatus;
  unreadCount: number;
  messageCount: number;
  shiftStartsAt: string;
  shiftEndsAt: string;
  lastMessageAt: string | null;
};

export type ShiftChatMessageType = "text" | "ping";

export type ShiftChatMessage = {
  id: number;
  threadId: number;
  senderUserId: number;
  senderName?: string | null;
  messageType: ShiftChatMessageType;
  body: string | null;
  lat: number | null;
  lng: number | null;
  createdAt: string;
};

export type ShiftChatThreadDetail = ShiftChatThread & {
  shiftStatus?: string | null;
};

export type ShiftChatsListResponse = {
  items: ShiftChatThread[];
};

export type ShiftChatMessagesResponse = {
  items: ShiftChatMessage[];
};

export type ShiftChatsSummaryResponse = {
  threadCount: number;
  messageCount: number;
  items: Array<{
    threadId: number;
    shiftId: number;
    userId: number;
    siteId: number;
    status: ShiftChatStatus;
    siteName: string;
    guardName: string | null;
    unreadCount: number;
  }>;
};

export type ShiftChatFilterParams = {
  date: string;
  siteId?: string;
  userId?: string;
  status?: string;
  threadId?: string;
};
