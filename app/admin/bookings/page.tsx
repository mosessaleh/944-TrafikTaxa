"use client";
import useSWR from 'swr'

const fetcher = (url:string)=> fetch(url,{cache:'no-store'}).then(r=>r.json())

function ActionBtn({id, action, label}:{id:number, action:string, label:string}){
  async function go(){
    await fetch('/api/admin/bookings/update',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id, action }) })
    location.reload()
  }
  return <button onClick={go} className="px-2 py-1 rounded border text-xs">{label}</button>
}

export default function AdminBookings(){
  const { data } = useSWR('/api/admin/bookings',{ fetcher })
  const rides = data?.rides||[]
  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-bold">Bookings</h1>
      <div className="overflow-x-auto bg-white border rounded-2xl">
        <table className="w-full text-sm">
          <thead><tr className="bg-gray-50 text-left"><th className="p-3">#</th><th className="p-3">User</th><th className="p-3">Pickup</th><th className="p-3">Dropoff</th><th className="p-3">Time</th><th className="p-3">Price</th><th className="p-3">Status</th><th className="p-3">Paid</th><th className="p-3">Actions</th></tr></thead>
          <tbody>
            {rides.map((r:any)=> (
              <tr key={r.id} className="border-t">
                <td className="p-3">{r.id}</td>
                <td className="p-3">{r.user?.firstName} {r.user?.lastName}</td>
                <td className="p-3">{r.pickupAddress}</td>
                <td className="p-3">{r.dropoffAddress}</td>
                <td className="p-3">{new Date(r.pickupTime).toLocaleString()}</td>
                <td className="p-3">{r.price} DKK</td>
                <td className="p-3">{r.status}</td>
                <td className="p-3">{r.paid? 'Yes':'No'}</td>
                <td className="p-3 flex gap-1 flex-wrap">
                  {r.status==='PENDING' && <ActionBtn id={r.id} action="CONFIRM" label="Confirm" />}
                  {(r.status==='CONFIRMED') && <ActionBtn id={r.id} action="DISPATCH" label="Dispatch" />}
                  {(r.status==='DISPATCHED') && <ActionBtn id={r.id} action="START" label="Start" />}
                  {(r.status==='ONGOING') && <ActionBtn id={r.id} action="COMPLETE" label="Complete" />}
                  {r.status!=='CANCELED' && r.status!=='COMPLETED' && <ActionBtn id={r.id} action="CANCEL" label="Cancel" />}
                  {!r.paid && <ActionBtn id={r.id} action="MARK_PAID" label="Mark Paid" />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
