// Düz "Yükleniyor..." yazısı yerine, içeriğin taslağını gösteren hafif "iskelet" bloklar.
// Kullanıcıya "az kaldı, ne geleceğini biliyorsun" hissi verir — premium uygulamaların standardı.
export default function Skeleton({ satirlar = 4 }: { satirlar?: number }) {
  return (
    <div className="flex flex-col gap-3 animate-pulse">
      {Array.from({ length: satirlar }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-border shrink-0" />
          <div className="flex-1 flex flex-col gap-1.5">
            <div className="h-3 bg-border rounded w-2/3" />
            <div className="h-2.5 bg-border rounded w-1/3" />
          </div>
        </div>
      ))}
    </div>
  )
}
