// @flow strict
/* A regionalised container for all the commercial tags. */

import fastdom from 'lib/fastdom-promise';
import {
    onConsentChange,
    getConsentFor,
} from '@guardian/consent-management-platform';
import { commercialFeatures } from 'common/modules/commercial/commercial-features';
import { imrWorldwide } from 'commercial/modules/third-party-tags/imr-worldwide';
import { imrWorldwideLegacy } from 'commercial/modules/third-party-tags/imr-worldwide-legacy';
import { remarketing } from 'commercial/modules/third-party-tags/remarketing';
import { ias, permutive, twitter, lotame, fbPixel } from '@guardian/commercial-core';
import { inizio } from 'commercial/modules/third-party-tags/inizio';
import { init as initPlistaRenderer } from 'commercial/modules/third-party-tags/plista-renderer';
import config from 'lib/config';
import {isInAuOrNz, isInUsOrCa} from "common/modules/commercial/geo-utils";

const addScripts = (tags: Array<ThirdPartyTag>): void => {
    const ref = document.scripts[0];
    const frag = document.createDocumentFragment();
    let hasScriptsToInsert = false;

    tags.forEach(tag => {
        if (tag.loaded === true) {
            return;
        }
        if (tag.beforeLoad) {
            tag.beforeLoad();
        }
        if (tag.useImage === true && typeof tag.url !== 'undefined') {
            new Image().src = tag.url;
        }
        if (tag.insertSnippet) {
            tag.insertSnippet();
        } else {
            hasScriptsToInsert = true;
            const script = document.createElement('script');
            if (typeof tag.url !== 'undefined') {
                script.src = tag.url;
            }
            script.onload = tag.onLoad;
            if (tag.async === true) {
                script.setAttribute('async', '');
            }
            if (tag.attrs) {
                tag.attrs.forEach(attr => {
                    script.setAttribute(attr.name, attr.value);
                });
            }
            frag.appendChild(script);
        }
        tag.loaded = true;
    });

    if (hasScriptsToInsert) {
        fastdom.mutate(() => {
            if (ref && ref.parentNode) {
                ref.parentNode.insertBefore(frag, ref);
            }
        });
    }
};

const insertScripts = (
    advertisingServices: Array<ThirdPartyTag>,
    performanceServices: Array<ThirdPartyTag> // performanceServices always run
): void => {
    addScripts(performanceServices);
    onConsentChange(state => {
        const consentedAdvertisingServices = advertisingServices.filter(
            script => getConsentFor(script.name, state)
        );

        if (consentedAdvertisingServices.length > 0) {
            addScripts(consentedAdvertisingServices);
        }
    });
};

const loadOther = (): void => {
    const advertisingServices: Array<ThirdPartyTag> = [
        remarketing(),
        permutive({ shouldRun: config.get('switches.permutive', false) }),
        ias({ shouldRun: config.get('switches.iasAdTargeting', false) }),
        inizio,
        fbPixel({ shouldRun: config.get('switches.facebookTrackingPixel', false)}),
        twitter({ shouldRun: config.get('switches.twitterUwt', false)}),
        lotame({ shouldRun:  config.get('switches.lotame', false) && !(isInUsOrCa() || isInAuOrNz())}),
    ].filter(_ => _.shouldRun);

    const performanceServices: Array<ThirdPartyTag> = [
        imrWorldwide, // only in AU & NZ
        imrWorldwideLegacy, // only in AU & NZ
    ].filter(_ => _.shouldRun);

    insertScripts(advertisingServices, performanceServices);
};

const init = (): Promise<boolean> => {
    if (!commercialFeatures.thirdPartyTags) {
        return Promise.resolve(false);
    }

    // Section 1
    // Outbrain/Plista needs to be loaded before the first ad as it is checking
    // for the presence of high relevance component on page
    // I'm leaving this to check adFree state because while the thirdPartyTags
    // check above is now sensitive to ad-free, it could be changed independently
    // in the future - even by accident.  Justin.
    if (!commercialFeatures.adFree) {
        initPlistaRenderer();
    }

    loadOther();

    return Promise.resolve(true);
};

export { init };
export const _ = {
    insertScripts,
    loadOther,
};
