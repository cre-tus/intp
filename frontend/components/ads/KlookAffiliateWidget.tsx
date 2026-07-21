"use client";

import { useEffect } from "react";

const KLOOK_SCRIPT_ID = "klook-affiliate-widget-script";
const KLOOK_SCRIPT_SRC = "https://affiliate.klook.com/widget/fetch-iframe-init.js";

export default function KlookAffiliateWidget() {
    useEffect(() => {
        if (document.getElementById(KLOOK_SCRIPT_ID)) return;

        const script = document.createElement("script");
        script.id = KLOOK_SCRIPT_ID;
        script.type = "text/javascript";
        script.async = true;
        script.src = KLOOK_SCRIPT_SRC;
        document.body.appendChild(script);
    }, []);

    return (
        <ins
            className="klk-aff-widget"
            data-wid="127201"
            data-adid="1338296"
            data-actids="74574,695,1410"
            data-prod="mul_act"
            data-price="false"
            data-lang="ko"
            data-width="160"
            data-height="600"
            data-currency="KRW"
        >
            <a href="//www.klook.com/">Klook.com</a>
        </ins>
    );
}
