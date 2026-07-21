import Image, { type StaticImageData } from "next/image";

type DestinationImageCardProps = {
    city: string;
    description: string;
    image: StaticImageData;
    alt: string;
};

export default function DestinationImageCard({
    city,
    description,
    image,
    alt,
}: DestinationImageCardProps) {
    return (
        <div
            data-city-card={city.toLowerCase()}
            className="group relative h-[360px] w-[270px] shrink-0 overflow-hidden rounded-2xl border border-white bg-gray-100 shadow-xl shadow-gray-900/10 sm:h-[410px] sm:w-[305px]"
        >
            <Image
                src={image}
                alt={alt}
                fill
                className="object-cover transition duration-500 group-hover:scale-105"
                sizes="305px"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent p-5 text-left text-white">
                <p className="text-xl font-bold">{city}</p>
                <p className="mt-1 text-sm text-white/80">{description}</p>
            </div>
        </div>
    );
}
