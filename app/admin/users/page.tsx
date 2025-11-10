import { prisma } from '@/lib/db'
export default async function AdminUsers(){
  const users = await prisma.user.findMany({ orderBy:{ id:'desc' } })
  async function PromoteButton({email, role}:{email:string, role:'USER'|'ADMIN'}){
    'use server'
    const next = role==='ADMIN'?'USER':'ADMIN'
    await fetch(process.env.NEXT_PUBLIC_APP_URL+`/api/admin/users/promote`,{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email, role: next }) })
  }
  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-bold">Users</h1>
      <div className="overflow-x-auto bg-white border rounded-2xl">
        <table className="w-full text-sm">
          <thead><tr className="bg-gray-50 text-left"><th className="p-3">ID</th><th className="p-3">Name</th><th className="p-3">Email</th><th className="p-3">Verified</th><th className="p-3">Role</th><th className="p-3">Actions</th></tr></thead>
          <tbody>
            {users.map(u=> (
              <tr key={u.id} className="border-t">
                <td className="p-3">{u.id}</td>
                <td className="p-3">{u.firstName} {u.lastName}</td>
                <td className="p-3">{u.email}</td>
                <td className="p-3">{u.emailVerified? 'Yes':'No'}</td>
                <td className="p-3">{u.role}</td>
                <td className="p-3"><form action={PromoteButton.bind(null,{ email:u.email, role:u.role as any })}><button className="px-3 py-1.5 rounded-xl border">{u.role==='ADMIN'?'Demote to USER':'Promote to ADMIN'}</button></form></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
