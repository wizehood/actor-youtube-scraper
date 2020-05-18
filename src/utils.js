const moment = require('moment');
const Apify = require('apify');
const { log } = Apify.utils;

exports.getDataFromXpath = async (page, xPath, attrib) => {
    await page.waitForXPath(xPath);
    const xElement = await page.$x(xPath);
    return page.evaluate((el, key) => el[key], xElement[0], attrib);
};

exports.unformatNumbers = (numStr) => {
    const numberMatch = numStr.replace(/[^0-9,.]/ig, '');
    if (numberMatch) {
        const number = parseFloat(numberMatch.replace(',', ''));
        const multiplierMatch = numStr.match(/(?<=[0-9 ])[mkb]/ig);

        if (multiplierMatch) {
            const multiplier = multiplierMatch[0].toUpperCase();
            switch (multiplier) {
                case 'K': {
                    return Math.round(number * 1000);
                }
                case 'M': {
                    return Math.round(number * 1000000);
                }
                case 'B': {
                    return Math.round(number * 1000000000);
                }
                default: throw new Error('Unhandled multiplier in getExpandedNumbers');
            }
        }

        return number;
    }

    // some videos may not have likes, views or channel subscribers
    return 0;
};

exports.getCutoffDate = (historyString) => {
    // input should have been validated
    // in format 'x minutes/hours/days/weeks/months/year ago'
    const matchNumbers = historyString.match(new RegExp('[0-9]+', 'ig'));
    const numDurations = parseInt(matchNumbers[0], 10);

    const matchDuration = historyString.match(new RegExp('(minute|hour|day|week|month|year)', 'ig'));
    const durationStr = matchDuration[0].toLowerCase();
    const durationType = `${durationStr}s`;

    return moment().subtract(numDurations, durationType);
};

exports.isDateInputValid = (postsFromDate) => {
    if (postsFromDate) {
        const matches = postsFromDate.match(/(^(1|([^0a-zA-Z ][0-9]{0,3})) (minute|hour|day|week|month|year))s? ago *$/ig);
        return !!matches;
    }

    return false;
};

exports.getYoutubeDateFilters = (postsFromDate) => {
    if (!exports.isDateInputValid(postsFromDate)) {
        return [];
    }

    const now = moment();
    const then = exports.getCutoffDate(postsFromDate);
    const duration = moment.duration(now.diff(then));

    const dateFilterMap = [
        { inTheLast: 'years', filter: null },
        { inTheLast: 'months', filter: 'This year' },
        { inTheLast: 'weeks', filter: 'This month' },
        { inTheLast: 'days', filter: 'This week' },
        { inTheLast: 'hours', filter: 'Today' },
        { inTheLast: 'minutes', filter: 'Last hour' },
    ];

    const youtubeFilters = [];
    // start with the longest duration
    for (let i = 0; i < dateFilterMap.length; i++) {
        const durType = dateFilterMap[i].inTheLast;
        const durCount = duration.as(durType);

        // e.g '2 days ago' results in 'This week' youtube filter being set
        if (durCount > 1) {
            if (dateFilterMap[i].filter) {
                youtubeFilters.push(dateFilterMap[i].filter);
            }
            break;
        }
    }

    if (youtubeFilters.length > 0) {
        // if we are using any of the youtube date filters
        // then we must also sort results by 'Upload date'
        youtubeFilters.push('Upload date');
    }

    return youtubeFilters;
};

exports.getVideoId = (videoUrl) => {
    const matches = videoUrl.match(/(?<=[/=])([0-9A-Za-z_-]{10,})[#/]?/ig);
    if (matches && matches.length > 0) {
        for (let i = 0; i < matches.length; i++) {
            const match = matches[i];

            // two-stage regex to cover all current types of youtube URLs
            const matches2 = match.match(/[#/]/ig);
            if (!matches2 && match.length <= 12) {
                return match;
            }
        }
    }
    return '';
};

exports.isErrorStatusCode = (statusCode) => {
    if (statusCode) {
        const statusNum = parseInt(`${statusCode}`, 10);
        return statusNum >= 400;
    }

    return false;
};

exports.getRandBetween = (min, max) => {
    return Math.floor(Math.random() * (max - min + 1) + min);
};

exports.getDelayMs = (minMax) => {
    return exports.getRandBetween(minMax.min, minMax.max);
};
