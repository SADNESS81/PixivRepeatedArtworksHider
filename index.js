// ==UserScript==
// @name        Pixiv Repeated Artworks Hider
// @namespace   =
// @match       *://www.pixiv.net/*
// @icon        https://www.google.com/s2/favicons?domain=pixiv.net
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_listValues
// @inject-into  content
// @version     1.2
// @author      SADNESS81
// @description Hides an artwork after it appears 3 times
// @license      MIT
// ==/UserScript==

const maxRepetitions = 3
const dimRepeated = false

let noReprocess = [];

const grabAndStoreNumbers = async (entry) => {
    const elements = selectElement(entry);
    await hideElements();
    if (elements && elements.length > 0) {
        const numbers = getNumbers(elements);
        if (numbers.length > 0) {
            storeNumbers(numbers);
        }
    }
};

const selectElement = (entry) => {
    const baseSelector = '#root > div.charcoal-token > div > div:nth-child(3) > div';
    const selectors = [
        `div > aside:nth-child(4) > div > section > div.gtm-illust-recommend-zone > div > div > ul > li:not([style="display: none;"]) > div > div.sc-iasfms-3.frFjhu > div > a`,
        `div.gtm-illust-recommend-zone > div > div > div > div > ul > li > div > div.sc-iasfms-3.frFjhu > div > a`,
        `div.gtm-illust-recommend-zone > div.sc-jeb5bb-1.dSVJt > div.sc-1kr69jw-2.hYTIUt > div.sc-1kr69jw-3.wJpxo > ul > div > div > div.sc-1kr69jw-3.wJpxo > ul > div > div > div > div.sc-iasfms-3.frFjhu > div > a`,
        `div > div > section > div.gtm-toppage-thumbnail-illustration-recommend-works-zone > ul > li > div > div.sc-iasfms-3.frFjhu > div > a`
    ];

    const combinedSelector = entry ? entry.target.querySelectorAll(selectors.map(selector => `${baseSelector} > ${selector}`).join(', ')) : `${baseSelector} > ${selectors.join(', ')} `;
    return combinedSelector;
};

const hideElements = async () => {
    const selectors = [
        '#root > div.charcoal-token > div > div:nth-child(3) > div > div > div > section > div.sc-s8zj3z-4.gjeneI > div.sc-ikag3o-0.dRXTLR > div > div > ul > li',
        '#root > div.charcoal-token > div > div:nth-child(3) > div > div.gtm-illust-recommend-zone > div > div > div > div > ul > li',
        '#root > div.charcoal-token > div > div:nth-child(3) > div > div.gtm-illust-recommend-zone > div.sc-jeb5bb-1.dSVJt > div.sc-1kr69jw-2.hYTIUt > div.sc-1kr69jw-3.wJpxo > ul > div > div > div.sc-1kr69jw-3.wJpxo > ul > div > div',
        '#root > div.charcoal-token > div > div:nth-child(3) > div > div > aside:nth-child(4) > div > section > div.gtm-illust-recommend-zone > div > div > ul > li',
        `#root > div.charcoal-token > div > div:nth-child(3) > div > div > div > section > div.gtm-toppage-thumbnail-illustration-recommend-works-zone > ul > li`
    ];

    await hideByCondition(selectors);
};

const hideByCondition = async (selectors) => {
    try {
        await hideElementsByCondition(selectors);
    } catch (error) {
        console.error('Error hiding', error);
    }
};

const hideElementsByCondition = async (selectors, condition) => {
    try {
        const [firstElement, ...remainingElements] = document.querySelectorAll(selectors.join(', '));

        if (!firstElement) {
            return;
        }

        await Promise.all([hideElement(firstElement), ...remainingElements.map(element => hideElement(element))]);
    } catch (error) {
        console.error('Error:', error);
        throw error;
    }
};

const hideElement = async (element) => {
    try {
        const isReprocessedSelector = 'div > div.sc-iasfms-3.frFjhu > div > a.reprocessed';

        const isReprocessed = Array.from(element.querySelectorAll(isReprocessedSelector))
            .some(el => el.style.display !== 'none');

        if (isReprocessed && dimRepeated === false) {
            element.style.display = 'none';
        } else if (dimRepeated === true && isReprocessed) {
            element.style.opacity = '0.2';
        }
    } catch (error) {
        console.error('Error hiding artwork:', error.message);
    }
};

const getNumbers = (elements) => {
    const numbers = [];
    const storedNumbers = getStoredNumbers();

    const shouldSkipProcessing = (parentLi) => parentLi?.style.display === 'none';

    const processGtmValue = (gtmValue, currentElement) => {
        const regex = /\b(\d+)\b/g;
        const matches = gtmValue.matchAll(regex);

        for (const match of matches) {
            const num = Number(match[1]);

            if (!storedNumbers.includes(num)) {
                numbers.push(num);
                handleProcessedElement(currentElement, num);
            } else {
                handleReprocessing(num, currentElement);
            }
        }
    };

    const handleProcessedElement = (currentElement, num) => {
        currentElement.classList.add('processed');
        noReprocess.push(num);
    };

    const handleReprocessing = (num, currentElement) => {
        const currentValue = getNumberCount(num);

        if (shouldReprocess(num, currentValue, currentElement)) {
            handleReprocessingCase1(num, currentValue, currentElement);
        } else if (shouldMarkAsReprocessed(num, currentValue, currentElement)) {
            handleReprocessingCase2(currentElement);
        }
    };

    const handleReprocessingCase1 = (num, currentValue, currentElement) => {
        if (maxRepetitions == 1) {
            GM_setValue(`${num}`, currentValue + 1);
            currentElement.classList.add('reprocessed')
        } else {
        noReprocess.push(num);
        GM_setValue(`${num}`, currentValue + 1);
        currentElement.classList.add('processed2');
        };
    };

    const handleReprocessingCase2 = (currentElement) => {
        currentElement.classList.add('reprocessed');
    };

    const shouldReprocess = (num, currentValue, currentElement) => {
        return storedNumbers.includes(num) && !noReprocess.includes(num) && currentValue <= maxRepetitions;
    };

    const shouldMarkAsReprocessed = (num, currentValue, currentElement) => {
        return storedNumbers.includes(num) && currentValue >= maxRepetitions && !noReprocess.includes(num);
    };

    const processElement = (currentElement) => {
        const parentLi = currentElement.closest('li');
        if (shouldSkipProcessing(parentLi)) return;

        const gtmValue = currentElement.dataset['gtmRecommendIllustId'];
        if (gtmValue && typeof gtmValue === 'string') {
            processGtmValue(gtmValue, currentElement);
        }
    };

    const processElements = () => {
        if (elements && elements.length > 0) {
            elements.forEach(processElement);
        }
    };

    processElements();

    return numbers;
};

const getStoredNumbers = () => {
    try {
        const keys = GM_listValues();
        let storedNumbers = [];
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            storedNumbers.push(JSON.parse(key)); // Assuming values are strings and need parsing
        }
        return storedNumbers;
    } catch (error) {
        console.error(`Error retrieving keys from storage: ${error.message}`);
        return [];
    }
};

const getNumberCount = (num) => {
    try {
        const count = GM_getValue(`${num}`, 0);
        return count;
    } catch (gmError) {
        console.error(`Error getting count for value ${num}: ${gmError.message}`);
        throw gmError;
    }
};

const storeNumbers = (numbers) => {
    try {
        if (!numbers || !Array.isArray(numbers) || numbers.length === 0) {
            throw new Error('Input must be a non-empty array of numbers');
        }

        const storedNumbers = getStoredNumbers();

        const filteredNumbers = numbers.filter(num => typeof num === 'number' && !isNaN(num) && num >= 0 && Number.isInteger(num) && !storedNumbers.includes(num));

        if (filteredNumbers.length === 0) {
            console.log('No valid, unique numbers found in the input array');
            return;
        }

        filteredNumbers.forEach(num => {
            try {
                const currentCount = getNumberCount(num)
                GM_setValue(`${num}`, currentCount + 1);
            } catch (gmError) {
                console.error(`Error storing value ${num}: ${gmError.message}`);
                throw gmError;
            }
        });
    } catch (error) {
        console.error(`Error: ${error.message}`);
        throw error;
    }
};

const intersectionCallback = (entries, observer) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            grabAndStoreNumbers(entry);
            observer.disconnect();
        }
    });
};

const createIntersectionObserver = (callback, options) => new IntersectionObserver(callback, options);

const waitForElement = async (selector) => {
    while (!document.querySelector(selector)) {
        await new Promise(resolve => requestAnimationFrame(resolve));
    }
};

const observeElements = (observer, elements) => {
    elements.forEach(element => observer.observe(element));
};

const isInRootBounds = (element, rootBounds) => {
    const { top, bottom, left, right } = element.getBoundingClientRect();
    return (
        top >= rootBounds.top &&
        bottom <= rootBounds.bottom &&
        left >= rootBounds.left &&
        right <= rootBounds.right
    );
};

const observeNewElements = (observer, targetElement, targetSelector) => {
    const rootBounds = document.querySelector(targetElement).getBoundingClientRect();
    const newElements = Array.from(document.querySelectorAll(targetSelector))
        .filter(element => isInRootBounds(element, rootBounds));
    
    observeElements(observer, newElements);
};

const configureMutationObserver = (callback, targetElement) => {
    const observer = new MutationObserver(callback);
    observer.observe(document.body, { childList: true, subtree: true });
    return observer;
};

const baseSelector = "#root > div.charcoal-token > div > div:nth-child(3) > div > div";
const targetSelector = [
    `${baseSelector}.gtm-illust-recommend-zone > div > div > div > div > ul > li`,
    `${baseSelector} > aside:nth-child(4) > div > section > div.gtm-illust-recommend-zone > div > div > ul > li`,
    `${baseSelector}.gtm-illust-recommend-zone > div.sc-jeb5bb-1.dSVJt > div.sc-1kr69jw-2.hYTIUt > div.sc-1kr69jw-3.wJpxo > ul > div > div > div.sc-1kr69jw-3.wJpxo > ul > div > div`,
    `${baseSelector} > div > section > div.gtm-toppage-thumbnail-illustration-recommend-works-zone > ul > li`
  ].join(", ");
  
  const targetElement = [
    `${baseSelector}.gtm-illust-recommend-zone`,
    `${baseSelector} > aside:nth-child(4) > div > section > div.gtm-illust-recommend-zone`,
    `${baseSelector}.gtm-illust-recommend-zone > div.sc-jeb5bb-1.dSVJt`,
    `${baseSelector} > div > section > div.gtm-toppage-thumbnail-illustration-recommend-works-zone`
  ].join(", ");

const options = {
    root: null,
    rootMargin: '1200px',
    threshold: 1.0
};

const intersectionObserver = createIntersectionObserver(intersectionCallback, options);

waitForElement(targetSelector).then(() => {
    const elements = document.querySelectorAll(targetSelector);

    observeElements(intersectionObserver, elements);

    const mutationObserver = configureMutationObserver(() => observeNewElements(intersectionObserver, targetElement, targetSelector), targetElement);
});