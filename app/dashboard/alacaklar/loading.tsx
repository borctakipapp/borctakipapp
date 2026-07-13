import Skeleton from '@/components/Skeleton'

export default function AlacaklarYukleniyor() {
  return (
    <main className="max-w-2xl mx-auto px-6 py-10 pb-24 md:pb-10">
      <div className="h-10 w-56 bg-border rounded animate-pulse mb-8" />
      <Skeleton satirlar={4} />
    </main>
  )
}