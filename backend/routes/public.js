const express = require('express');
const homepageController = require('../controllers/homepageController');
const productController = require('../controllers/productController');
const offerController = require('../controllers/offerController');
const contentController = require('../controllers/contentController');

const branchController = require('../controllers/branchController');
const tdSlotController = require('../controllers/tdSlotController');
const metaLeadController = require('../controllers/metaLeadController');

const router = express.Router();

router.get('/config', homepageController.getPublicConfig);
router.get('/site-config', homepageController.getPublicSiteConfig);
router.get('/dealer-settings', homepageController.getPublicDealerSettings);
router.get('/products', productController.getPublicProducts);
router.get('/products/:slug', productController.getPublicProductBySlug);
router.get('/hero-slides', homepageController.getPublicHeroSlides);
router.get('/offers', offerController.getPublicOffers);
router.get('/banners', contentController.getPublicBanners);
router.get('/faqs', contentController.getPublicFaqs);
router.get('/testimonials', contentController.getPublicTestimonials);
router.get('/td/branches', branchController.getPublicBranches);
router.get('/td/slots/config', tdSlotController.getPublicSlotConfig);
router.get('/td/slots/available', tdSlotController.getAvailableSlotsForDate);
router.get('/All_leads', metaLeadController.getAllPublic);

module.exports = router;
