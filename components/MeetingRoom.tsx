"use client";

import {
  Call,
  CallControls,
  CallingState,
  SpeakerLayout,
  StreamCall,
  StreamVideo,
  StreamVideoClient,
  StreamVideoProvider,
  useCall,
  useCallStateHooks,
  ParticipantView,
} from "@stream-io/video-react-sdk";
import "@stream-io/video-react-sdk/dist/css/styles.css";

import {
  Chat,
  Channel,
  ChannelHeader,
  MessageList,
  MessageInput,
} from "stream-chat-react";
import "stream-chat-react/dist/css/index.css";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useParams, useRouter } from "next/navigation";
import { StreamChat } from "stream-chat";
import Loader from "./Loader";
import { useGetCallById } from "@/hooks/useGetCallById";
import { approveUser, rejectUser } from "@/lib/actions/call.actions";

const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY!;
const chatClient = StreamChat.getInstance(apiKey);

const MeetingRoom = () => {
  const { user: clerkUser } = useUser();
  const { id } = useParams();
  const router = useRouter();
  const { call, isLoading } = useGetCallById(id as string);
  const [videoClient, setVideoClient] = useState<StreamVideoClient | null>(null);
  const [callObj, setCallObj] = useState<Call | null>(null);
  const [chatReady, setChatReady] = useState(false);
  const [showChat, setShowChat] = useState(false);

  const user = {
    id: clerkUser?.id || "",
    name: clerkUser?.username || "User",
    image: clerkUser?.imageUrl || "",
  };

  useEffect(() => {
    const init = async () => {
      if (!clerkUser || !call) return;

      const token = await clerkUser.getToken({ template: "stream-video-chat" });

      const client = new StreamVideoClient({ apiKey, user, token });
      setVideoClient(client);

      const callInstance = client.call("default", id as string);
      await callInstance.join();
      setCallObj(callInstance);

      await chatClient.connectUser(user, token);
      setChatReady(true);
    };

    init();

    return () => {
      videoClient?.disconnectUser();
      chatClient.disconnectUser();
    };
  }, [clerkUser, call, id]);

  const { useCallCallingState, useParticipantCount } = useCallStateHooks();
  const callingState = useCallCallingState();
  const participantCount = useParticipantCount();
  const callInstance = useCall();

  const handleApprove = async () => {
    await approveUser({ callId: id as string, userId: user.id });
    router.push(`/meeting/${id}`);
  };

  const handleReject = async () => {
    await rejectUser({ callId: id as string, userId: user.id });
    router.push("/");
  };

  if (isLoading || !videoClient || !callObj) {
    return <Loader />;
  }

  return (
    <StreamVideoProvider client={videoClient}>
      <StreamCall call={callObj}>
        <div className="relative h-screen w-full bg-black text-white">
          <SpeakerLayout />

          <div className="absolute bottom-0 w-full flex items-center justify-between px-4 py-2 bg-black bg-opacity-70 z-40">
            <CallControls />
            <button
              className="ml-auto px-4 py-2 text-white bg-blue-600 rounded hover:bg-blue-700"
              onClick={() => setShowChat((prev) => !prev)}
            >
              {showChat ? "Hide Chat" : "Show Chat"}
            </button>
          </div>

          {call?.isPrivate && !call.isUserApproved.includes(user.id) && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black bg-opacity-90 text-center">
              <p className="text-xl mb-4">You are not approved to join this private call.</p>
              <div className="flex gap-4">
                <button
                  onClick={handleApprove}
                  className="bg-green-600 px-4 py-2 rounded hover:bg-green-700"
                >
                  Approve
                </button>
                <button
                  onClick={handleReject}
                  className="bg-red-600 px-4 py-2 rounded hover:bg-red-700"
                >
                  Reject
                </button>
              </div>
            </div>
          )}

          {showChat && chatReady && (
            <div className="absolute right-0 top-0 h-full w-[350px] bg-[#11141a] border-l border-neutral-800 z-50 p-2">
              <Chat client={chatClient}>
                <Channel channel={chatClient.channel("livestream", id as string)}>
                  <ChannelHeader />
                  <MessageList />
                  <MessageInput />
                </Channel>
              </Chat>
            </div>
          )}
        </div>
      </StreamCall>
    </StreamVideoProvider>
  );
};

export default MeetingRoom;
