// synergywizard.com and www → the same page on poe2.90sgamer.com (301, path and query kept, so UTM tags
// and shared searches survive). Browsers keep the referrer through a 301, so GA still credits the real source.
export default {
  fetch(request) {
    const url = new URL(request.url);
    return Response.redirect(`https://poe2.90sgamer.com${url.pathname}${url.search}`, 301);
  },
};
