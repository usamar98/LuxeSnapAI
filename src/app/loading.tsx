import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="min-h-screen bg-background p-6">
      <div className="mx-auto grid max-w-[1480px] gap-5 lg:grid-cols-[330px_minmax(0,1fr)_360px]">
        <Skeleton className="h-[720px] rounded-lg" />
        <Skeleton className="h-[720px] rounded-lg" />
        <Skeleton className="h-[720px] rounded-lg" />
      </div>
    </main>
  );
}
