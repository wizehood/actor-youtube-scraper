const Apify = require('apify');
const utils = require('./utils');
const { log, sleep, puppeteer } = Apify.utils;

exports.scrape = async (page, input) => {
    const searchSelector = "input#search";

    log.debug('waiting for input box...');
    const searchElement = await page.waitForSelector(searchSelector, { visible: true });
    if (searchElement) {
        log.debug(`search box input found at ${searchSelector}`);
    }

    log.debug('waiting for first video to load...');
    const ytVideoSelector = "#contents > ytd-video-renderer";
    await page.waitForSelector(ytVideoSelector, { visible: true });

    let ytVideos = await page.$$(ytVideoSelector);
    if (ytVideos.length === 0) {
        throw new Error(`The keywords '${input.searchKeywords} return no youtube videos, try a different search`);
    }

    console.log("Total videos found: " + ytVideos.length)

    let videos = []
    for (const video of ytVideos) {
        const titleElement = await video.$('#video-title');
        const title = await page.evaluate(title => title.textContent.trim(), titleElement)
        const href = await page.evaluate(title => title.getAttribute('href').trim(), titleElement)
        const url = `https://www.youtube.com${href}`
        const id = utils.getVideoId(href)

        const thumbnailUrl = await video.$eval('#img', el => el.getAttribute("src"))
        // const screenshotBuffer = await thumbnail.screenshot();
        // await Apify.setValue(id, screenshotBuffer, { contentType: 'image/png' });

        const duration = await video.$eval('span.ytd-thumbnail-overlay-time-status-renderer', el => el.textContent.trim());
        const metadataInfo = await video.$eval('#metadata-line', el => el.textContent.trim())
        if (!metadataInfo) continue

        const metadata = await video.$$eval('#metadata-line > span', metas => { return metas.map(meta => meta.textContent) })

        let views = metadata[0] ? metadata[0].replace('views', '').trim() : null
        const uploadDate = metadata[1] ? metadata[1].trim() : null

        console.log({ title })
        console.log({ metadata })

        views = utils.unformatNumbers(views)
        videos.push({ title, url, thumbnailUrl, id, duration, views, uploadDate })
    }
    await Apify.pushData(videos)
};

exports.handleGoto = async ({ page, request }) => {
    await puppeteer.blockRequests(page);
    return page.goto(request.url, { waitUntil: 'networkidle0' });
};

exports.handleLaunch = (launchOpts) => {
    launchOpts.apifyProxySession = `sesn_${Math.floor(Math.random() * 100000)}`;
    return Apify.launchPuppeteer(launchOpts);
};

exports.handleFails = async ({ request }) => {
    Apify.utils.log.error(`Request ${request.url} failed too many times`);
    await Apify.pushData({
        '#debug': Apify.utils.createRequestDebugInfo(request),
    });
};
