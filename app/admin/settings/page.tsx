import { prisma } from '@/lib/db'

export default async function AdminSettings(){
  let s = await prisma.settings.findFirst()
  if (!s) {
    s = await prisma.settings.create({ data: { dayBase:40, dayPerKm:12.75, dayPerMin:5.75, nightBase:60, nightPerKm:16, nightPerMin:7, workStart:'06:00', workEnd:'18:00' } })
  }
  async function save(formData: FormData){
    'use server'
    const data = Object.fromEntries(formData) as any
    await prisma.settings.update({ where:{ id: s!.id }, data: {
      dayBase: Number(data.dayBase), dayPerKm: Number(data.dayPerKm), dayPerMin: Number(data.dayPerMin),
      nightBase: Number(data.nightBase), nightPerKm: Number(data.nightPerKm), nightPerMin: Number(data.nightPerMin),
      workStart: String(data.workStart), workEnd: String(data.workEnd),
      companyName: String(data.companyName||''), contactEmail: String(data.contactEmail||''), contactPhone: String(data.contactPhone||''), addressCity: String(data.addressCity||'')
    } })
  }
  return (
    <div className="grid gap-6 max-w-3xl">
      <h1 className="text-2xl font-bold">Settings</h1>
      <form action={save} className="grid gap-6 bg-white border rounded-2xl p-6">
        <div className="grid md:grid-cols-3 gap-3">
          <label className="grid gap-1"><span className="text-sm text-gray-600">Day base</span><input name="dayBase" defaultValue={String(s.dayBase)} className="border rounded-xl px-3 py-2"/></label>
          <label className="grid gap-1"><span className="text-sm text-gray-600">Day per km</span><input name="dayPerKm" defaultValue={String(s.dayPerKm)} className="border rounded-xl px-3 py-2"/></label>
          <label className="grid gap-1"><span className="text-sm text-gray-600">Day per min</span><input name="dayPerMin" defaultValue={String(s.dayPerMin)} className="border rounded-xl px-3 py-2"/></label>
          <label className="grid gap-1"><span className="text-sm text-gray-600">Night base</span><input name="nightBase" defaultValue={String(s.nightBase)} className="border rounded-xl px-3 py-2"/></label>
          <label className="grid gap-1"><span className="text-sm text-gray-600">Night per km</span><input name="nightPerKm" defaultValue={String(s.nightPerKm)} className="border rounded-xl px-3 py-2"/></label>
          <label className="grid gap-1"><span className="text-sm text-gray-600">Night per min</span><input name="nightPerMin" defaultValue={String(s.nightPerMin)} className="border rounded-xl px-3 py-2"/></label>
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <label className="grid gap-1"><span className="text-sm text-gray-600">Work starts</span><input name="workStart" defaultValue={s.workStart} className="border rounded-xl px-3 py-2"/></label>
          <label className="grid gap-1"><span className="text-sm text-gray-600">Work ends</span><input name="workEnd" defaultValue={s.workEnd} className="border rounded-xl px-3 py-2"/></label>
        </div>
        <div className="grid gap-3">
          <h2 className="font-semibold">Company</h2>
          <label className="grid gap-1"><span className="text-sm text-gray-600">Company name</span><input name="companyName" defaultValue={s.companyName||''} className="border rounded-xl px-3 py-2"/></label>
          <div className="grid md:grid-cols-3 gap-3">
            <label className="grid gap-1"><span className="text-sm text-gray-600">Email</span><input name="contactEmail" defaultValue={s.contactEmail||''} className="border rounded-xl px-3 py-2"/></label>
            <label className="grid gap-1"><span className="text-sm text-gray-600">Phone</span><input name="contactPhone" defaultValue={s.contactPhone||''} className="border rounded-xl px-3 py-2"/></label>
            <label className="grid gap-1"><span className="text-sm text-gray-600">City</span><input name="addressCity" defaultValue={s.addressCity||''} className="border rounded-xl px-3 py-2"/></label>
          </div>
        </div>
        <button className="bg-black text-white rounded-2xl px-5 py-3 w-max">Save settings</button>
      </form>
    </div>
  )
}
