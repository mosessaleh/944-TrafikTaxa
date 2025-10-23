import Link from "next/link";
export default function LocalNav() {
  const items = [
    { href: "/admin", label: "Dashboard" },
    { href: "/admin/pi", label: "Pi Price" },
  ];
  return (
    <div className="flex gap-2 mb-4">
      {items.map(i => (
        <Link key={i.href} href={i.href} className="px-3 py-1.5 rounded-full border hover:bg-gray-50">
          {i.label}
        </Link>
      ))}
    </div>
  );
}
