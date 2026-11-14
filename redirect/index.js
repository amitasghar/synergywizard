// www.synergywizard.com and the old address poe2.90sgamer.com → the same page on synergywizard.com
// (301, path and query kept, so UTM tags, shared searches and saved-list links survive).
// Browsers keep the referrer through a 301, so GA still credits the real source.
export default {
  fetch(request) {
    const url = new URL(request.url);
    return Response.redirect(`https://synergywizard.com${url.pathname}${url.search}`, 301);
  },
};
