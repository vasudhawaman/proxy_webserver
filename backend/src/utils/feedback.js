const feedbackList = [];

export function addFeedback(url, status) {
  const exists = feedbackList.some(entry => entry.url === url);
  if (!exists) {
    feedbackList.push({ url, status });
  }else{
    return 'URL already in list'
  }
}


export function clearFeedback() {
  feedbackList.length = 0;
}

export function getFeedback() {
  return [...feedbackList];
}

export function getFeedbackStatus(url) {
  const entry = feedbackList.find(entry => entry.url === url);
  return entry ? entry.status : undefined;
}
