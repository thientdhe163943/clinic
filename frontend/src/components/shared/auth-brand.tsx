import Image from 'next/image';

export function AuthBrand() {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-md">
        <Image src="/logo.jpg" alt="Phòng Khám Đa Khoa Âu Cơ Phú Hà" width={64} height={64} className="h-full w-full object-cover" priority />
      </div>
      <h1 className="mt-4 text-xl font-bold tracking-tight text-foreground sm:text-2xl">
        Phòng Khám Đa Khoa Âu Cơ Phú Hà
      </h1>
    </div>
  );
}
