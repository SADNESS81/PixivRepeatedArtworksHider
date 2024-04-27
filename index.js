// ==UserScript==
// @name        Pixiv Repeated Artworks Hider
// @namespace   =
// @match       *://www.pixiv.net/*
// @icon        https://www.google.com/s2/favicons?domain=pixiv.net
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_listValues
// @inject-into  content
// @version     1.5
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
  const baseSelector =
    ppixiv === false
      ? "#root > div.charcoal-token > div > div:nth-child(3) > div"
      : "body";
  const selectors =
    ppixiv === false
      ? [
          `div > aside:nth-child(4) > div > section > div.gtm-illust-recommend-zone > div > div > ul > li:not([style="display: none;"]) > div > div.sc-iasfms-3.frFjhu > div > a`,
          `div.gtm-illust-recommend-zone > div > div > div > div > ul > li > div > div.sc-iasfms-3.frFjhu > div > a`,
          `div.gtm-illust-recommend-zone > div.sc-jeb5bb-1.dSVJt > div.sc-1kr69jw-2.hYTIUt > div.sc-1kr69jw-3.wJpxo > ul > div > div > div.sc-1kr69jw-3.wJpxo > ul > div > div > div > div.sc-iasfms-3.frFjhu > div > a`,
          `div > div > section > div.gtm-toppage-thumbnail-illustration-recommend-works-zone > ul > li > div > div.sc-iasfms-3.frFjhu > div > a`,
        ]
      : [
          `div.screen.screen-search-container.widget > div.search-results.scroll-container > vv-container > div > div.thumbnails > div > div > a`,
        ];

  const combinedSelector = entry
    ? entry.target.querySelectorAll(
        selectors.map((selector) => `${baseSelector} > ${selector}`).join(", ")
      )
    : `${baseSelector} > ${selectors.join(", ")} `;
  return combinedSelector;
};

const hideElements = async () => {
  if (ppixiv === false) {
    selectors = [
      "#root > div.charcoal-token > div > div:nth-child(3) > div > div > div > section > div.sc-s8zj3z-4.gjeneI > div.sc-ikag3o-0.dRXTLR > div > div > ul > li",
      "#root > div.charcoal-token > div > div:nth-child(3) > div > div.gtm-illust-recommend-zone > div > div > div > div > ul > li",
      "#root > div.charcoal-token > div > div:nth-child(3) > div > div.gtm-illust-recommend-zone > div.sc-jeb5bb-1.dSVJt > div.sc-1kr69jw-2.hYTIUt > div.sc-1kr69jw-3.wJpxo > ul > div > div > div.sc-1kr69jw-3.wJpxo > ul > div > div",
      "#root > div.charcoal-token > div > div:nth-child(3) > div > div > aside:nth-child(4) > div > section > div.gtm-illust-recommend-zone > div > div > ul > li",
      "#root > div.charcoal-token > div > div:nth-child(3) > div > div > div > section > div.gtm-toppage-thumbnail-illustration-recommend-works-zone > ul > li",
    ];
  }

  if (ppixiv === true) {
    selectors = [
      "body > div.screen.screen-search-container.widget > div.search-results.scroll-container > vv-container > div > div.thumbnails > div > div",
    ];
  }

  try {
    const [firstElement, ...remainingElements] = document.querySelectorAll(
      selectors.join(", ")
    );

    if (!firstElement) return;

    await Promise.all([
      hideElement(firstElement),
      ...remainingElements.map((element) => hideElement(element)),
    ]);
  } catch (error) {
    console.error("Error:", error);
    throw error;
  }
};

const hideElement = async (element) => {
  try {
    if (ppixiv === true) {
      const pagesToIgnore = [
        "bookmarks",
        "artworks",
        "ranking",
        "bookmark_new_illust",
        "complete",
        "users",
      ];

      if (pagesToIgnore.some((page) => window.location.href.includes(page))) {
        return;
      }
    }

    const isReprocessedSelector =
      ppixiv === false
        ? "div > div.sc-iasfms-3.frFjhu > div > a.reprocessed"
        : "a.reprocessed";

    const isReprocessed = Array.from(
      element.querySelectorAll(isReprocessedSelector)
    ).some((el) => el.style.display !== "none");

    if (isReprocessed && dimRepeated === false && ppixiv === true) {
      const parent = element.parentNode;
      const isLastElement = element.nextElementSibling === null;
      if (isLastElement) {
        parent.remove();
        element.remove();
      } else {
        element.remove();
      }
    }

    if (dimRepeated === true && isReprocessed && ppixiv === true) {
      element.style.opacity = "0.2";
    }

    if (isReprocessed && dimRepeated === false && ppixiv === false) {
      element.style.display = "none";
    }

    if (dimRepeated === true && isReprocessed && ppixiv === false) {
      element.style.opacity = "0.2";
    }
  } catch (error) {
    console.error("Error hiding artwork:", error.message);
  }
};

const noReprocess = new Set();

const getNumbers = (elements) => {
  const numbers = new Set();
  const storedNumbers = new Set(getStoredNumbers());

  if (ppixiv === true) {
    const pagesToIgnore = [
      "bookmarks",
      "artworks",
      "ranking",
      "bookmark_new_illust",
      "complete",
      "users",
    ];

    if (pagesToIgnore.some((page) => window.location.href.includes(page))) {
      return;
    }
  }

  const shouldSkipProcessing = (parentLi) => parentLi?.style.display === "none";

  const processGtmValue = (gtmValue, currentElement) => {
    regex = ppixiv === false ? /\b(\d+)\b/g : /\b(\d+)-(\d+)\b|\b(\d+)\b/g;

    let match;
    while ((match = regex.exec(gtmValue)) !== null) {
      const num =
        ppixiv === false ? Number(match[1]) : Number(match[1] || match[3]);

      if (num !== 0) {
        if (!storedNumbers.has(num)) {
          numbers.add(num);
          currentElement.classList.add("processed");
          noReprocess.add(num);
        } else {
          const currentValue = getNumberCount(num);

          if (
            storedNumbers.has(num) &&
            !noReprocess.has(num) &&
            currentValue <= maxRepetitions
          ) {
            if (maxRepetitions == 1) {
              GM_setValue(`${num}`, currentValue + 1);
              currentElement.classList.add("reprocessed");
            } else {
              noReprocess.add(num);
              GM_setValue(`${num}`, currentValue + 1);
              currentElement.classList.add("processed2");
            }
          } else if (
            storedNumbers.has(num) &&
            currentValue >= maxRepetitions &&
            !noReprocess.has(num)
          ) {
            currentElement.classList.add("reprocessed");
          }
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

  const processElements = () => {
    if (elements && elements.length > 0) {
      elements.forEach(processElement);
    }
  };

  processElements();

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
  if (!numbers || !Array.isArray(numbers) || numbers.length === 0)
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

  if (storedNumbers.size === 0) {
    console.log("No valid, unique numbers found in the input array");
  }
};

if (countWithoutRefresh === true) {
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
  baseSelector =
    "#root > div.charcoal-token > div > div:nth-child(3) > div > div";
  targetSelector = [
    `${baseSelector}.gtm-illust-recommend-zone > div > div > div > div > ul > li`,
    `${baseSelector} > aside:nth-child(4) > div > section > div.gtm-illust-recommend-zone > div > div > ul > li`,
    `${baseSelector}.gtm-illust-recommend-zone > div.sc-jeb5bb-1.dSVJt > div.sc-1kr69jw-2.hYTIUt > div.sc-1kr69jw-3.wJpxo > ul > div > div > div.sc-1kr69jw-3.wJpxo > ul > div > div`,
    `${baseSelector} > div > section > div.gtm-toppage-thumbnail-illustration-recommend-works-zone > ul > li`,
  ].join(", ");

  targetElement = [
    `${baseSelector}.gtm-illust-recommend-zone`,
    `${baseSelector} > aside:nth-child(4) > div > section > div.gtm-illust-recommend-zone`,
    `${baseSelector}.gtm-illust-recommend-zone > div.sc-jeb5bb-1.dSVJt`,
    `${baseSelector} > div > section > div.gtm-toppage-thumbnail-illustration-recommend-works-zone`,
  ].join(", ");
}

if (ppixiv === true) {
  targetSelector = [
    `body > div.screen.screen-search-container.widget > div.search-results.scroll-container > vv-container > div > div.thumbnails > div > div`,
  ].join(", ");

  targetElement = [
    `body > div.screen.screen-search-container.widget > div.search-results.scroll-container > vv-container > div > div.thumbnails`,
  ].join(", ");
}

if (ppixiv === false) {
  options = {
    root: null,
    rootMargin: "1200px",
    threshold: 0.5,
  };
}

if (ppixiv === true) {
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
