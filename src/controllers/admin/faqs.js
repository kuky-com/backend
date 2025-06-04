const ModeratorFaqs = require("../../models/moderator_faqs");

// Get all FAQs
const getAllFAQs = async () => {
    try {
        const faqs = await ModeratorFaqs.findAll({
            order: [
                ['ranking', 'DESC']
            ]
        });
        return {
            data: faqs,
            message: 'FAQs retrieved successfully'
        };
    } catch (error) {
        throw new Error(`Error fetching FAQs: ${error.message}`);
    }
};

// Create new FAQ
const createFAQ = async (faqData) => {
    try {
        const { question, answer, is_active } = faqData;

        const newFAQ = await ModeratorFaqs.create({
            question,
            answer,
            is_active: is_active || true
        });

        return {
            data: newFAQ,
            message: 'FAQ created successfully'
        };
    } catch (error) {
        throw new Error(`Error creating FAQ: ${error.message}`);
    }
};

// Update FAQ
const updateFAQ = async (id, updateData) => {
    try {
        const faq = await ModeratorFaqs.findByPk(id);
        if (!faq) {
            throw new Error('FAQ not found');
        }

        await faq.update(updateData);

        return {
            data: faq,
            message: 'FAQ updated successfully'
        };
    } catch (error) {
        throw new Error(`Error updating FAQ: ${error.message}`);
    }
};

// Delete FAQ
const deleteFAQ = async (id) => {
    try {
        const faq = await ModeratorFaqs.findByPk(id);
        if (!faq) {
            throw new Error('FAQ not found');
        }

        await faq.destroy();

        return {
            message: 'FAQ deleted successfully'
        };
    } catch (error) {
        throw new Error(`Error deleting FAQ: ${error.message}`);
    }
};

module.exports = {
    getAllFAQs,
    createFAQ,
    updateFAQ,
    deleteFAQ
};