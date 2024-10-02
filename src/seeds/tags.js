const Tags = require('../models/tags')

async function createDefaultTags() {
    const predefineTags = [
        'Outdoor Enthusiast',
        'Fitness Buff',
        'Tech Savvy',
        'Creative Mind',
        'Food Lover',
        'Health & Wellness Advocate',
        'Adventure Seeker',
        'Animal Lover',
        'Music Enthusiast',
        'Movie Buff',
        'Fashionista',
        'Gamer',
        'Social Butterfly',
        'Bookworm',
        'Environmentalist',
        'Spiritual Seeker',
        'DIY & Crafts Enthusiast',
        'Personal Development Seeker',
        'Career Oriented',
        'Family Focused',
        'History Buff',
        'Art Lover',
        'Home Chef',
        'Wine & Spirits Enthusiast',
        'Collector',
        'Car Enthusiast',
        'Volunteer',
        'Sports Fan',
        'Board Game Geek',
        'Homebody',
        'Traveler',
        'Gardener',
        'Photography Enthusiast',
        'Science & Discovery',
        'Political Activist',
        'Financial Guru',
        'Language Learner',
        'Podcast Lover',
        'Urban Explorer',
        'Skilled Trades Enthusiast',
        'Fitness Competitor',
        'Fantasy & Sci-Fi Fan',
        'Humanitarian',
        'Environmental Conservationist',
        'Cultural Enthusiast'
    ]

    predefineTags.forEach(async (item) => {
        await Tags.findOrCreate({
            where: {
                name: item
            }
        })
    })
}

module.exports = {
    createDefaultTags
}