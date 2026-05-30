import React from "react";
import Image from "next/image";

export default function HeaderLogo() {
    return (
        <div className="relative flex h-[56px] w-[56px] items-center justify-center shrink-0">
            <style>{`
                .logo-dark {
                    display: none !important;
                }
                .logo-light {
                    display: block !important;
                }
                .dark-mode .logo-dark {
                    display: block !important;
                }
                .dark-mode .logo-light {
                    display: none !important;
                }
            `}</style>
            
            {/* Light mode logo icon */}
            <Image
                src="/icon.svg"
                alt="INTP logo"
                width={56}
                height={56}
                priority
                className="logo-light shrink-0"
            />
            
            {/* Dark mode logo icon */}
            <Image
                src="/icon_dark.svg"
                alt="INTP logo"
                width={56}
                height={56}
                priority
                className="logo-dark shrink-0"
            />
        </div>
    );
}
