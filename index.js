// ==UserScript==
// @name          Pixiv Repeated Artworks Hider
// @namespace     =
// @match         *://www.pixiv.net/*
// @icon          https://www.google.com/s2/favicons?domain=pixiv.net
// @grant         GM_getValue
// @grant         GM_setValue
// @grant         GM_deleteValue
// @grant         GM_listValues
// @inject-into   content
// @run-at        document-idle
// @version       2.2
// @author        SADNESS81
// @description   Hides an artwork after it appears 3 times
// @license       MIT
// ==/UserScript==

let ppixiv = false;
let lastHref = window.location.href;
const noReprocess = new Set();

const settings = {
  maxRepetitions: 3,
  hideAuthor: false,
  dimRepeated: false,
  whitelistFollowed: true,
};

Object.keys(settings).forEach((key) => {
  settings[key] = getOrSetValue(key, settings[key]);
});

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

if (window.location.href.includes("#ppixiv")) {
  ppixiv = true;
  console.log("ppixiv true");
}

const grabAndStoreNumbers = async (entry) => {
  const numbers = getNumbers(selectElement(entry));
  numbers.length > 0 && storageManager.storeNumbers(numbers);
};

const checkReprocessed = (currentElement, num, currentValue) => {
  if (
    noReprocess.has(num) ||
    !storageManager.getStoredNumbers().includes(num) ||
    GM_getValue("Following", []).includes(num)
  ) {
    return;
  }

  if (
    currentValue >= settings.maxRepetitions ||
    (currentValue < settings.maxRepetitions && settings.maxRepetitions === 1)
  ) {
    currentElement.classList.add("reprocessed");
  }
};

const whitelistFollowing = async (element, task, action) => {
  if (!settings.whitelistFollowed) {
    GM_deleteValue("Account");
    GM_deleteValue("Following");
    return;
  }

  let userId = parseInt(
    Object.keys(localStorage)
      .find((key) => key.match(/^viewed_illust_ids_(\d+)$/))
      ?.match(/\d+/)
  );

  if (!userId) return;

  let user = GM_getValue("Account");
  let value = GM_getValue("Following", []);
  let times = GM_getValue("Times", 0);

  if (times < 10) {
    times++;
    GM_setValue("Times", times);
  } else {
    times = 0;
    GM_setValue("Times", times);
    GM_setValue("Following", []);
    whitelistFollowing(null, "two", null);
  }

  if (user !== userId) {
    GM_setValue("Account", userId);
    GM_setValue("Following", []);
    value = [];
    user = userId;
  }

  if (task === "one" && value.length !== 0) {
    const { idValue } = storageManager.getElementValues(element);
    if (
      idValue &&
      ((action === "add" && !value.includes(idValue)) || (action === "remove" && value.includes(idValue)))
    ) {
      value = action === "add" ? [...value, idValue] : value.filter((v) => v !== idValue);
      GM_setValue("Following", value);
    }
    GM_deleteValue(idValue.toString());
  }

  if (value.length === 0 || task === "two") {
    const fetchFollowing = async (restType) => {
      let offset = 0,
        total = 0;
      try {
        while (offset === 0 || offset < total) {
          await delay(1000);
          const data = await fetch(
            `https://www.pixiv.net/ajax/user/${userId}/following?offset=${offset}&limit=100&rest=${restType}`
          ).then((res) => res.json());
          if (data.body?.users) {
            value = [...new Set([...value, ...data.body.users.map((user) => user.userId)])];
            total = offset === 0 ? data.body.total : total;
            offset += 100;
          }
        }
      } catch (error) {
        console.error(`Error fetching following list for rest=${restType}:`, error);
      }
    };

    for (const restType of ["show", "hide"]) {
      await fetchFollowing(restType);
    }

    GM_setValue("Following", value);
    value.forEach((id) => GM_deleteValue(id.toString()));
  }
};

whitelistFollowing();

const getNumbers = (elements, task) => {
  const numbers = new Set();
  const storedNumbers = new Set(storageManager.getStoredNumbers());
  const following = new Set(GM_getValue("Following", []));

  if (
    ppixiv &&
    ["bookmarks", "artworks", "ranking", "bookmark_new_illust", "complete", "users"].some((page) =>
      lastHref.includes(page)
    )
  ) {
    return [];
  }

  if (!elements || elements.length === 0) {
    return [];
  }

  const regex = ppixiv ? /\b(\d+)-(\d+)\b|\b(\d+)\b/g : /\b(\d+)\b/g;

  elements.forEach((currentElement) => {
    const { idValue, gtmValue } = storageManager.getElementValues(currentElement);
    const value = settings.hideAuthor ? idValue : gtmValue;

    if (!value) {
      return;
    }

    let match;
    while ((match = regex.exec(value)) !== null) {
      const num = Number(ppixiv ? match[1] || match[3] : match[1]);

      if (!num) {
        continue;
      }

      const currentValue = storageManager.getNumberCount(num);

      if (task === "checkReprocessed") {
        checkReprocessed(currentElement, num, currentValue);
      }

      if (!settings.whitelistFollowed || (!following.has(idValue) && settings.whitelistFollowed)) {
        processNumbers(currentElement, num, currentValue, storedNumbers, numbers);
      }
    }
  });

  return Array.from(numbers);
};

const processNumbers = (currentElement, num, currentValue, storedNumbers, numbers) => {
  if (!storedNumbers.has(num)) {
    numbers.add(num);
    currentElement.classList.add("processed");
    noReprocess.add(num);
  } else if (!noReprocess.has(num) && currentValue < settings.maxRepetitions && settings.maxRepetitions !== 1) {
    GM_setValue(`${num}`, currentValue + 1);
    currentElement.classList.add("processed2");
    noReprocess.add(num);
  }
};

function getOrSetValue(key, defaultValue) {
  let value = GM_getValue(key);
  if (value === undefined) {
    value = defaultValue;
    GM_setValue(key, value);
  }
  return value;
}

const storageManager = {
  getStoredNumbers: () => {
    try {
      const excludedKeys = [
        "maxRepetitions",
        "hideAuthor",
        "dimRepeated",
        "whitelistFollowed",
        "Account",
        "Following",
        "Times",
      ];
      return GM_listValues()
        .filter((key) => !excludedKeys.includes(key))
        .map((key) => JSON.parse(key));
    } catch (error) {
      console.error(`Error retrieving keys from storage: ${error.message}`);
      return [];
    }
  },

  getNumberCount: (num) => {
    try {
      return GM_getValue(`${num}`, 0);
    } catch (gmError) {
      console.error(`Error getting count for value ${num}: ${gmError.message}`);
      throw gmError;
    }
  },

  storeNumbers: (numbers) => {
    const storedNumbers = new Set(storageManager.getStoredNumbers());
    numbers
      .filter((num) => !isNaN(num) && num >= 0 && !storedNumbers.has(num))
      .forEach((num) => {
        try {
          GM_setValue(`${num}`, storageManager.getNumberCount(num) + 1);
          storedNumbers.add(num);
        } catch (gmError) {
          console.error(`Error storing value ${num}: ${gmError.message}`);
          throw gmError;
        }
      });
  },

  getElementValues: (currentElement) => {
    const getValue = (...keys) => keys.reduce((acc, key) => acc || currentElement.dataset[key], null);
    const idValue = ppixiv ? getValue("userId") : getValue("gtmUserId", "user_id");
    const gtmValue = ppixiv ? getValue("mediaId") : getValue("gtmRecommendIllustId", "gtmValue");
    return { idValue, gtmValue };
  },
};

const selectElement = (entry) => {
  const ppixivSelector =
    ppixiv === false
      ? [
          `#illust-recommend > ul > li > a.user.ui-profile-popup.js-click-trackable.gtm-illust-recommend-user-name`,
          `.sc-iasfms-3.frFjhu a`,
        ]
      : [`.thumbnails a`];

  return entry ? entry.target.querySelectorAll(ppixivSelector) : ppixivSelector;
};

const getSelectors = () => {
  return ppixiv === false
    ? [
        `.sc-s8zj3z-4.gjeneI > .sc-ikag3o-0.dRXTLR ul > li`,
        `.gtm-illust-recommend-zone ul > li`,
        `.gtm-toppage-thumbnail-illustration-recommend-works-zone ul > li`,
        `.gtm-toppage-thumbnail-r18-illustration-recommend-works-zone > ul > li`,
        `.gtm-toppage-thumbnail-illustration-recommend-tag-zone ul > li`,
        `.gtm-toppage-thumbnail-r18-illustration-recommend-tag-zone ul > li`,
        `#illust-recommend > ul > li`,
        `.sc-l7cibp-0.juyBTC ul > li`,
        `.sc-1kr69jw-4.gueEHy ul > div`,
        `.sc-1kr69jw-3.wJpxo > ul > div > div > div.sc-1kr69jw-3.wJpxo > ul > div > div`,
      ]
    : [".thumbnails > div > div"];
};

const isElementReprocessed = (element) => {
  return Array.from(element.querySelectorAll("a.reprocessed")).some((el) => getComputedStyle(el).display !== "none");
};

const areAllSiblingsHidden = (element) => {
  return Array.from(element.parentNode.children).every((sibling) => sibling.style.display === "none");
};

const hideOrDimElement = (element, allSiblingsHidden) => {
  if (ppixiv && !window.location.href.match(/(bookmarks|artworks|ranking|bookmark_new_illust|complete|users)/)) {
    allSiblingsHidden ? (element.parentNode.style.display = "none") : (element.style.display = "none");
  } else if (!settings.dimRepeated) {
    element.style.display = "none";
  } else {
    element.style.opacity = "0.2";
  }
};

const hideElements = async () => {
  const selectors = getSelectors();

  try {
    const elements = document.querySelectorAll(selectors.join(", "));

    await Promise.all(
      Array.from(elements).map(async (element) => {
        try {
          const isReprocessed = isElementReprocessed(element);
          const allSiblingsHidden = areAllSiblingsHidden(element);

          if (isReprocessed) {
            hideOrDimElement(element, allSiblingsHidden);
          }
        } catch (error) {
          console.error("Error hiding artwork:", error.message);
        }
      })
    );
  } catch (error) {
    console.error("Error:", error);
    throw error;
  }
};

const selectors = ppixiv
  ? [`.thumbnails > div > div`]
  : [
      `.gtm-illust-recommend-zone ul > li`,
      `aside:nth-child(4) .gtm-illust-recommend-zone ul > li`,
      `.gtm-illust-recommend-zone .sc-jeb5bb-1.dSVJt .sc-1kr69jw-2.hYTIUt .sc-1kr69jw-3.wJpxo ul > div > div > div.sc-1kr69jw-3.wJpxo ul > div > div`,
      `.gtm-toppage-thumbnail-illustration-recommend-works-zone ul > li`,
      `#illust-recommend > ul > li`,
      `.sc-l7cibp-0.juyBTC ul > li`,
      `.gtm-toppage-thumbnail-illustration-recommend-tag-zone ul > li`,
      `.gtm-toppage-thumbnail-r18-illustration-recommend-tag-zone ul > li`,
      `.gtm-toppage-thumbnail-r18-illustration-recommend-works-zone ul > li`,
      //`.sc-1kr69jw-4.gueEHy ul > div`,
    ];

const options = ppixiv
  ? { root: null, rootMargin: "0px", threshold: 0.5 }
  : { root: null, rootMargin: "0px", threshold: 0.5 };

targetSelector = selectors.join(", ");

const intersectionCallback = (entries, observer) =>
  entries.forEach((entry) => entry.isIntersecting && grabAndStoreNumbers(entry));

const createObserver = (callback, options, targetSelector) => {
  const observer = new IntersectionObserver(callback, options);
  const cachedElements = new Set();

  const observeElements = () => {
    document.querySelectorAll(targetSelector).forEach((el) => {
      if (!cachedElements.has(el)) {
        getNumbers(selectElement({ target: el }), "checkReprocessed");
        observer.observe(el);
        cachedElements.add(el);
        hideElements();
      }
    });

    document.querySelectorAll(".fliWFr").forEach((button) => {
      let value = GM_getValue("Following", []);
      if (!cachedElements.has(button)) {
        button.addEventListener("click", function () {
          if (value.length !== 0) {
            const action = button.textContent.trim().toLowerCase() === "following" ? "remove" : "add";
            whitelistFollowing(button, "one", action);
          } else {
            whitelistFollowing(null, "two");
          }
        });
        cachedElements.add(button);
      }
    });
  };

  new MutationObserver(() => {
    clearTimeout(this.timeoutId);
    this.timeoutId = setTimeout(observeElements, 100);
  }).observe(document.body, { childList: true, subtree: true });

  observeElements();
  return observer;
};

const observer = createObserver(intersectionCallback, options, targetSelector);

const createElement = (tag, props) => Object.assign(document.createElement(tag), props);

const [button, menu, maxRepetitionsInput] = [
  createElement("button", {
    textContent: "Settings",
    style:
      "position: fixed; top: 85%; left: 96%; transform: translate(-50%, -50%); background-color: #181a1b; color: #ffffff;",
  }),
  createElement("div", {
    style:
      "position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background-color: #181a1b; color: #ffffff; padding: 10px; border: 1px solid #3a3e41; border-radius: 5px; box-shadow: 0px 8px 15px rgba(0, 0, 0, 0.1); display: none;",
  }),
  createElement("input", {
    type: "number",
    value: settings.maxRepetitions,
    min: 1,
  }),
];

menu.append(createElement("label", { textContent: "Max Repetitions: " }), maxRepetitionsInput);

maxRepetitionsInput.addEventListener("input", () => {
  let value = Math.max(parseInt(maxRepetitionsInput.value), 1);
  maxRepetitionsInput.value = value;
  GM_setValue("maxRepetitions", value);
});

const toggleCheckbox = (text, key) => {
  const [p, checkbox] = [
    createElement("p", { textContent: `${text}: ${settings[key]}` }),
    createElement("input", { type: "checkbox" }),
  ];
  checkbox.checked = settings[key];
  checkbox.addEventListener("change", () => {
    p.textContent = `${text}: ${(settings[key] = checkbox.checked)}`;
    GM_setValue(key, settings[key]);
  });
  menu.append(p, checkbox);
};

["Hide Author", "Dim Repeated", "Whitelist Following"].forEach((text, index) =>
  toggleCheckbox(text, Object.keys(settings)[index + 1])
);

setTimeout(() => {
  document.body.append(button, menu);
  button.addEventListener("click", () => (menu.style.display = menu.style.display === "none" ? "block" : "none"));
  document.addEventListener("click", (event) => {
    if (!button.contains(event.target) && !menu.contains(event.target)) menu.style.display = "none";
  });
}, 3000);
