// ==UserScript==
// @name        Pixiv Repeated Artworks Hider
// @namespace   =
// @match       *://www.pixiv.net/*
// @icon        https://www.google.com/s2/favicons?domain=pixiv.net
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_listValues
// @inject-into  content
// @version     1.8
// @author      SADNESS81
// @description Hides an artwork after it appears 3 times
// @license      MIT
// ==/UserScript==

// Settings //

const maxRepetitions = 3;

const hideAuthor = false;

const dimRepeated = false;

const countWithoutRefresh = false; // Will count the artwork as repeated if you were navigating through the webpage without refreshing. Normally it will count the artwork as repeated after refreshing and coming across it

/*-----------------------------*/

let ppixiv = false;

const grabAndStoreNumbers = async (entry) => {
  const elements = selectElement(entry);
  const numbers = elements?.length > 0 && getNumbers(elements);
  numbers?.length > 0 && storeNumbers(numbers);
};

const selectElement = (entry) => {
  const ppixivSelector =
    ppixiv === false
      ? [
          `.gtm-illust-recommend-zone a:not([style*="display: none;"])`,
          `.gtm-illust-recommend-zone .frFjhu a`,
          `.gtm-toppage-thumbnail-illustration-recommend-works-zone .frFjhu a`,
        ]
      : [`.screen-search-container .search-results .thumbnails a`];

  const baseSelector =
    ppixiv === false ? "#root .charcoal-token > div" : "body";
  const selectors = ppixivSelector
    .map((selector) => `${baseSelector} ${selector}`)
    .join(", ");

  return entry ? entry.target.querySelectorAll(selectors) : selectors;
};

const hideElements = async () => {
  let selectors =
    ppixiv === false
      ? [
          ".sc-s8zj3z-4.gjeneI > .sc-ikag3o-0.dRXTLR ul > li",
          ".gtm-illust-recommend-zone ul > li",
          ".gtm-toppage-thumbnail-illustration-recommend-works-zone ul > li",
        ]
      : [".screen-search-container .search-results .thumbnails > div"];

  try {
    const elements = document.querySelectorAll(selectors.join(", "));
    await Promise.all([...elements].map((element) => hideElement(element)));
  } catch (error) {
    console.error("Error:", error);
    throw error;
  }
};

const hideElement = async (element) => {
  try {
    const isPPixiv = ppixiv === true;
    const isReprocessedSelector = isPPixiv
      ? "a.reprocessed"
      : "div > div.sc-iasfms-3.frFjhu > div > a.reprocessed";
    const isReprocessed = Array.from(
      element.querySelectorAll(isReprocessedSelector)
    ).some((el) => el.style.display !== "none");

    if (isPPixiv) {
      const pagesToIgnore = [
        "bookmarks",
        "artworks",
        "ranking",
        "bookmark_new_illust",
        "complete",
        "users",
      ];
      if (pagesToIgnore.some((page) => window.location.href.includes(page)))
        return;

      if (isReprocessed && !dimRepeated) {
        if (element.nextElementSibling === null) element.parentNode.remove();
        element.remove();
      }

      if (dimRepeated && isReprocessed) element.style.opacity = "0.2";
    } else {
      if (isReprocessed && !dimRepeated) element.style.display = "none";
      if (dimRepeated && isReprocessed) element.style.opacity = "0.2";
    }
  } catch (error) {
    console.error("Error hiding artwork:", error.message);
  }
};

const noReprocess = new Set();

const getNumbers = (elements) => {
  const numbers = new Set();
  const storedNumbers = new Set(getStoredNumbers());
  const currentHref = window.location.href;

  if (ppixiv) {
    const pagesToIgnore = new Set([
      "bookmarks",
      "artworks",
      "ranking",
      "bookmark_new_illust",
      "complete",
      "users",
    ]);

    if ([...pagesToIgnore].some((page) => currentHref.includes(page))) {
      return [];
    }
  }

  const shouldSkipProcessing = (parentLi) => parentLi?.style.display === "none";

  const processGtmValue = (gtmValue, currentElement) => {
    const regex = ppixiv ? /\b(\d+)-(\d+)\b|\b(\d+)\b/g : /\b(\d+)\b/g;

    let match;
    while ((match = regex.exec(gtmValue)) !== null) {
      const num = ppixiv ? Number(match[1] || match[3]) : Number(match[1]);

      if (num !== 0 && !storedNumbers.has(num)) {
        numbers.add(num);
        currentElement.classList.add("processed");
        noReprocess.add(num);
      } else if (storedNumbers.has(num) && !noReprocess.has(num)) {
        const currentValue = getNumberCount(num);

        if (currentValue < maxRepetitions) {
          GM_setValue(`${num}`, currentValue + 1);
          currentElement.classList.add(
            maxRepetitions == 1 ? "reprocessed" : "processed2"
          );
          if (maxRepetitions != 1) noReprocess.add(num);
        } else if (currentValue >= maxRepetitions) {
          currentElement.classList.add("reprocessed");
        }
      }
    }
  };

  const processElement = (currentElement) => {
    const parentLi = currentElement.closest("li");
    if (shouldSkipProcessing(parentLi)) return;

    const { idValue, gtmValue } = getIdAndGtmValues(currentElement);

    if (hideAuthor === true) {
      if (typeof idValue === "string") {
        processGtmValue(idValue, currentElement);
      }
    } else {
      if (typeof gtmValue === "string") {
        processGtmValue(gtmValue, currentElement);
      }
    }
  };

  if (elements && elements.length > 0) {
    elements.forEach(processElement);
  }

  return Array.from(numbers);
};

const getIdAndGtmValues = (currentElement) => {
  let idValue, gtmValue;

  if (ppixiv === false) {
    idValue = currentElement.dataset["gtmUserId"];
    gtmValue = currentElement.dataset["gtmRecommendIllustId"];
  }

  if (ppixiv === true) {
    idValue = currentElement.dataset["userId"];
    gtmValue = currentElement.dataset["mediaId"];
  }

  return { idValue, gtmValue };
};

const getStoredNumbers = () => {
  try {
    return GM_listValues().map((key) => JSON.parse(key));
  } catch (error) {
    console.error(`Error retrieving keys from storage: ${error.message}`);
    return [];
  }
};

const getNumberCount = (num) => {
  try {
    return GM_getValue(`${num}`, 0);
  } catch (gmError) {
    console.error(`Error getting count for value ${num}: ${gmError.message}`);
    throw gmError;
  }
};

const storeNumbers = (numbers) => {
  if (!numbers?.length)
    throw new Error("Input must be a non-empty array of numbers");
  const storedNumbers = new Set(getStoredNumbers());
  for (const num of numbers) {
    if (
      typeof num === "number" &&
      !isNaN(num) &&
      num >= 0 &&
      Number.isInteger(num) &&
      !storedNumbers.has(num)
    ) {
      try {
        GM_setValue(`${num}`, getNumberCount(num) + 1);
        storedNumbers.add(num);
      } catch (gmError) {
        console.error(`Error storing value ${num}: ${gmError.message}`);
        throw gmError;
      }
    }
  }
  if (!storedNumbers.size)
    console.log("No valid, unique numbers found in the input array");
};

function clearNoReprocess() {
  noReprocess.clear();
  console.log("noReprocess Cleared");
}

let lastHref = window.location.href;
const checkURL = () => {
  const currentHref = window.location.href;
  if (currentHref !== lastHref) {
    clearNoReprocess();
    lastHref = currentHref;
  }
};

if (countWithoutRefresh === true) {
  setInterval(checkURL, 1000);
}

if (window.location.href.includes("#ppixiv")) {
  ppixiv = true;
  console.log("ppixiv true");
}

const intersectionCallback = (entries, observer) => {
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (entry.isIntersecting) {
      grabAndStoreNumbers(entry);
      hideElements();
    }
  }
};

const createIntersectionObserver = (callback, options) =>
  new IntersectionObserver(callback, options);

const observeElements = (observer, elements) => {
  for (let i = 0; i < elements.length; i++) {
    observer.observe(elements[i]);
  }
};

const configureMutationObserver = (callback, targetElement) => {
  const observer = new MutationObserver(callback);
  observer.observe(document.body, { childList: true, subtree: true });
  return observer;
};

if (ppixiv === false) {
  const baseSelector = "#root .charcoal-token > div > div > div";
  targetSelector = [
    `${baseSelector} .gtm-illust-recommend-zone ul > li`,
    `${baseSelector} aside:nth-child(4) .gtm-illust-recommend-zone ul > li`,
    `${baseSelector} .gtm-illust-recommend-zone .sc-jeb5bb-1.dSVJt .sc-1kr69jw-2.hYTIUt .sc-1kr69jw-3.wJpxo ul > div > div > div.sc-1kr69jw-3.wJpxo ul > div > div`,
    `${baseSelector} .gtm-toppage-thumbnail-illustration-recommend-works-zone ul > li`,
  ].join(", ");

  targetElement = [
    `${baseSelector} .gtm-illust-recommend-zone`,
    `${baseSelector} aside:nth-child(4) .gtm-illust-recommend-zone`,
    `${baseSelector} .gtm-illust-recommend-zone .sc-jeb5bb-1.dSVJt`,
    `${baseSelector} .gtm-toppage-thumbnail-illustration-recommend-works-zone`,
  ].join(", ");

  options = {
    root: null,
    rootMargin: "1200px",
    threshold: 0.5,
  };
} else {
  targetSelector = [
    `body .screen-search-container .search-results .thumbnails > div`,
  ].join(", ");

  targetElement = [
    `body .screen-search-container .search-results .thumbnails`,
  ].join(", ");

  options = {
    root: null,
    rootMargin: "9600px",
    threshold: 0.1,
  };
}

function createIntersectionAndMutationObserver(
  intersectionCallback,
  options,
  targetSelector,
  targetElement
) {
  const intersectionObserver = createIntersectionObserver(
    intersectionCallback,
    options
  );
  const mutationCallback = () =>
    observeElements(
      intersectionObserver,
      document.querySelectorAll(targetSelector)
    );
  const mutationObserver = configureMutationObserver(
    mutationCallback,
    targetElement
  );
  return { intersectionObserver, mutationObserver };
}

const { intersectionObserver, mutationObserver } =
  createIntersectionAndMutationObserver(
    intersectionCallback,
    options,
    targetSelector,
    targetElement
  );
