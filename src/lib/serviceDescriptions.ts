/**
 * Ready-made listing descriptions a provider can drop in with one tap (and then edit).
 * Matched by service name; unknown/new services get sensible general templates.
 */
const BY_SERVICE: Record<string, string[]> = {
  cook: [
    'Experienced home cook for daily meals — desi, BBQ and continental. I cook fresh in your kitchen with your ingredients and keep the kitchen clean afterwards.',
    'Desi specialist: karahi, biryani, qorma, daal and fresh rotis. Happy to cook for small families or guests and follow your spice level and diet needs.',
    'Healthy & diet-friendly cooking — low-oil meals, salads and meal prep for the week. Hygienic, punctual and respectful of your home.',
  ],
  dishwasher: [
    'Dishes, pots and pans washed and dried, sink and counters wiped clean. Careful with glassware and non-stick cookware.',
    'After-party or daily dish cleaning — I sort, wash, dry and put everything back in place so your kitchen is ready to use.',
    'Quick, hygienic dishwashing with your preferred detergent. Also clean the stove top and kitchen slab on request.',
  ],
  'house cleaner': [
    'Full home cleaning — sweeping, mopping, dusting, bathrooms and kitchen. I bring basic supplies or use yours.',
    'Deep cleaning for rooms, bathrooms and kitchen, including fans, windows and cupboards. Ideal before guests or after moving.',
    'Regular weekly cleaning you can rely on — tidy rooms, fresh bathrooms and a spotless kitchen, every visit.',
  ],
  cleaner: [
    'Full home cleaning — sweeping, mopping, dusting, bathrooms and kitchen. I bring basic supplies or use yours.',
    'Deep cleaning for rooms, bathrooms and kitchen, including fans, windows and cupboards.',
    'Regular weekly cleaning you can rely on — tidy rooms, fresh bathrooms and a spotless kitchen.',
  ],
  electrician: [
    'Licensed-level electrical work: wiring, switches, sockets, fans, lights and DB boxes. Safe, neat work with my own tools.',
    'Quick fixes for tripping breakers, short circuits, UPS/inverter wiring and appliance installation. Fault found and explained before repair.',
    'New fittings and renovations — fan & light installation, concealed wiring and load checks. Clean finish, no mess left behind.',
  ],
  plumber: [
    'Leaks, taps, showers, flush tanks and blocked drains fixed fast. I bring my own tools and fittings.',
    'Bathroom & kitchen plumbing — new fittings, geyser connections, water motor and tank lines. Neat, leak-tested work.',
    'Emergency and routine plumbing at fair hourly rates. I explain the problem and the cost before starting.',
  ],
  carpenter: [
    'Furniture repair & assembly — beds, wardrobes, doors, drawers and hinges fixed properly. Own tools included.',
    'Custom woodwork: shelves, kitchen cabinets and door fitting, with a clean, polished finish.',
    'Door locks, handles, sliding tracks and loose joints repaired quickly and neatly.',
  ],
  painter: [
    'Interior & exterior painting with neat edges and full furniture covering. Walls, doors, grills and touch-ups.',
    'Room makeovers — wall prep, putty, primer and two coats for a smooth, long-lasting finish.',
    'Small jobs welcome: touch-ups, single walls, doors and polish work, done carefully and on time.',
  ],
  'ac technician': [
    'AC service & cleaning (indoor + outdoor), gas check/refill and cooling performance test for split and window ACs.',
    'AC installation, shifting and repair — PCB, capacitor, fan motor and leakage issues diagnosed and fixed.',
    'Pre-summer AC tune-up: filter wash, coil cleaning and gas pressure check so your AC cools faster and uses less power.',
  ],
  laundry: [
    'Washing, drying, folding and ironing at your home — whites and colours handled separately with care.',
    'Weekly laundry help: machine wash, hang-dry and neat ironing of shalwar kameez, shirts and bedsheets.',
    'Ironing specialist — crisp, wrinkle-free clothes, starched on request, folded and ready to wear.',
  ],
  babysitter: [
    'Caring, patient babysitter for infants and young children — feeding, play, naps and homework help.',
    'Experienced with toddlers: safe play, meals on schedule and a calm bedtime routine. References available.',
    'Evening or weekend childcare so you can relax — attentive, gentle and always in touch with parents.',
  ],
  driver: [
    'Safe, punctual personal driver for your own car — office, school runs, errands and family trips.',
    'Experienced city & highway driver with valid licence. Knows routes well, drives carefully and keeps the car clean.',
    'Hourly driver for appointments, shopping or events — wait time included, polite and reliable.',
  ],
  gardener: [
    'Lawn mowing, trimming, weeding and watering — your garden kept fresh and tidy.',
    'Plant care & planting: seasonal flowers, pots, hedges and fertiliser, with advice for healthy growth.',
    'Garden clean-up and makeovers — leaves cleared, beds re-shaped and plants pruned neatly.',
  ],
};

export function suggestedDescriptions(serviceName: string | undefined | null): string[] {
  const key = (serviceName ?? '').trim().toLowerCase();
  if (BY_SERVICE[key]) return BY_SERVICE[key];
  const n = serviceName?.trim() || 'this service';
  return [
    `Experienced ${n.toLowerCase()} professional. I arrive on time, bring my own tools and leave everything neat and clean.`,
    `Reliable ${n.toLowerCase()} service at a fair hourly rate. I explain the work and the time needed before I start.`,
    `Friendly, careful and hygienic — quality ${n.toLowerCase()} work you can trust in your home.`,
  ];
}
