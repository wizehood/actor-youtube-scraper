const Apify = require('apify');
const utils = require('./utils');
const scraper = require('./scraper');

const { log } = Apify.utils;

Apify.main(async () => {
    const input = await Apify.getInput();

    const { verboseLog, startUrl } = input;
    if (verboseLog) {
        log.setLevel(log.LEVELS.DEBUG);
    } else {
        log.setLevel(log.LEVELS.WARNING);
    }

    // proxy settings
    const proxyConfig = { useApifyProxy: true, ...input.proxyConfiguration };

    // launch options - puppeteer
    const launchOptions = { ...proxyConfig };
    launchOptions.stealth = true;
    launchOptions.useChrome = true;

    const requestQueue = await Apify.openRequestQueue();

    // scraper options - puppeteer
    const scraperOptions = {};
    scraperOptions.requestQueue = requestQueue;
    scraperOptions.launchPuppeteerOptions = launchOptions;

    scraperOptions.launchPuppeteerFunction = scraper.handleLaunch;
    scraperOptions.gotoFunction = scraper.handleGoto;
    scraperOptions.handleFailedRequestFunction = scraper.handleFails;
    scraperOptions.handlePageFunction = async ({ page, request }) => {
        if (utils.isErrorStatusCode(request.statusCode)) {
            throw new Error(`Request error status code: ${request.statusCode} msg: ${request.statusMessage}`);
        }

        await scraper.scrape(page, input)
    };

    // add starting url
    await requestQueue.addRequest({ url: startUrl + input.searchKeywords });

    const crawler = new Apify.PuppeteerCrawler(scraperOptions);
    await crawler.run();
});
