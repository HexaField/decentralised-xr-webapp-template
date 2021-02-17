export function simplifyObject(object) {
  let messageData = {};
  for (let prop in object)
    if (typeof object[prop] !== 'function' && typeof object[prop] !== 'object')
      messageData[prop] = object[prop];
  return messageData;
}
