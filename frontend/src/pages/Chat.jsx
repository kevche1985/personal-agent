import ChatWindow from '../components/ChatWindow.jsx';

export default function Chat() {
  return (
    <div className="h-[calc(100vh-57px)] flex flex-col">
      <div className="px-6 py-4 border-b border-gray-200 bg-white">
        <h1 className="text-lg font-semibold text-gray-900">Chat</h1>
        <p className="text-xs text-gray-400 mt-0.5">Natural language interface — create tasks, log expenses, check budgets</p>
      </div>
      <div className="flex-1 overflow-hidden">
        <ChatWindow />
      </div>
    </div>
  );
}
