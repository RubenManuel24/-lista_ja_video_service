const { Queue } = require("bullmq");
const { connection } = require("../connection");

const videoQueue = new Queue("render-video", { connection });
const overlayQueue = new Queue("render-video-overlay", { connection });
const pdfQueue = new Queue("render-pdf", { connection });
const imageQueue = new Queue("render-image", { connection });

module.exports = { videoQueue, overlayQueue, pdfQueue, imageQueue };
