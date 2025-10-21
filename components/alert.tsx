export default function Alert({ title, message, action }: { title: string; message: string; action?: React.ReactNode }){
  return (
    <div className="border rounded-2xl p-4 bg-yellow-50 text-yellow-900">
      <div className="font-semibold">{title}</div>
      <div className="text-sm mt-1">{message}</div>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
