import React, { useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'skyspy-live-radios-v1';
const DEFAULT_FEEDS = [{ key: 'kaus3_twr', label: 'KAUS Tower', volume: 0.7 }];
const validKey = (key) => typeof key === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(key);

function loadFeeds() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!Array.isArray(saved)) return DEFAULT_FEEDS;
    const seen = new Set();
    return saved
      .filter((feed) => {
        if (!feed || !validKey(feed.key) || seen.has(feed.key)) return false;
        seen.add(feed.key);
        return true;
      })
      .map((feed) => ({
        key: feed.key,
        label: typeof feed.label === 'string' ? feed.label.slice(0, 100) : feed.key,
        volume: Number.isFinite(feed.volume) ? Math.max(0, Math.min(1, feed.volume)) : 0.7,
      }));
  } catch {
    return DEFAULT_FEEDS;
  }
}

function LiveRadioPlayer({ feed, onVolume, onRemove }) {
  const audioRef = useRef(null);
  const attemptRef = useRef(0);
  const [status, setStatus] = useState('Stopped');
  const active = status === 'Connecting' || status === 'Playing';

  useEffect(() => {
    audioRef.current.volume = feed.volume;
  }, [feed.volume]);

  useEffect(() => {
    const audio = audioRef.current;
    return () => {
      attemptRef.current += 1;
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    };
  }, []);

  const stop = () => {
    attemptRef.current += 1;
    const audio = audioRef.current;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    setStatus('Stopped');
  };

  const play = async () => {
    const attempt = ++attemptRef.current;
    const audio = audioRef.current;
    // LiveATC's dispatcher selects the stream server and supplies nocache.
    audio.src = `https://d.liveatc.net/${encodeURIComponent(feed.key)}`;
    setStatus('Connecting');
    try {
      await audio.play();
    } catch {
      if (attempt === attemptRef.current)
        setStatus('Unable to play. Check the feed key and try again.');
    }
  };

  return (
    <div className="v2-radio-live__feed" role="group" aria-label={feed.label}>
      {/* Live audio has no caption track supplied by the provider. */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio
        ref={audioRef}
        preload="none"
        onPlaying={() => setStatus('Playing')}
        onWaiting={() => {
          if (audioRef.current?.getAttribute('src')) setStatus('Connecting');
        }}
        onError={() => {
          if (audioRef.current?.getAttribute('src'))
            setStatus('Unable to play. Check the feed key and try again.');
        }}
        onEnded={() => setStatus('Stream ended. Press Play to reconnect.')}
      />
      <div className="v2-radio-live__identity">
        <strong>{feed.label}</strong>
        <small>{feed.key}</small>
        <span role="status">{status}</span>
      </div>
      <button
        type="button"
        onClick={active ? stop : play}
        aria-label={`${active ? 'Stop' : 'Play'} ${feed.label}`}
      >
        {active ? 'Stop' : 'Play'}
      </button>
      <label className="v2-radio-live__volume">
        Volume {Math.round(feed.volume * 100)}%
        <input
          aria-label={`${feed.label} volume`}
          type="range"
          min="0"
          max="100"
          value={Math.round(feed.volume * 100)}
          onChange={(e) => onVolume(Number(e.target.value) / 100)}
        />
      </label>
      <button type="button" onClick={onRemove} aria-label={`Remove ${feed.label}`}>
        Remove
      </button>
    </div>
  );
}

export function LiveRadioPanel() {
  const [feeds, setFeeds] = useState(loadFeeds);
  const [key, setKey] = useState('');
  const [label, setLabel] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(feeds));
    } catch {
      /* Storage may be unavailable. */
    }
  }, [feeds]);

  const addFeed = (event) => {
    event.preventDefault();
    const mount = key.trim();
    if (!validKey(mount)) {
      setError('Enter a feed key using letters, numbers, underscores, or hyphens.');
      return;
    }
    if (feeds.some((feed) => feed.key.toLowerCase() === mount.toLowerCase())) {
      setError('That feed is already in your list.');
      return;
    }
    setFeeds((prev) => [...prev, { key: mount, label: label.trim() || mount, volume: 0.7 }]);
    setKey('');
    setLabel('');
    setError('');
  };

  return (
    <section className="v2-radio-live" aria-label="Live radio">
      <h2>Live radio</h2>
      <p>
        Listen to multiple LiveATC feeds together. Feeds and volumes are saved in this browser.
        Leaving Radio stops playback.
      </p>
      <form onSubmit={addFeed} className="v2-radio-live__form">
        <label>
          Feed key
          <input
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="kaus3_twr"
            maxLength={100}
            required
          />
        </label>
        <label>
          Label
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="KAUS Tower"
            maxLength={100}
          />
        </label>
        <button type="submit">Add radio</button>
      </form>
      {error && <p role="alert">{error}</p>}
      {feeds.map((feed) => (
        <LiveRadioPlayer
          key={feed.key}
          feed={feed}
          onVolume={(volume) =>
            setFeeds((prev) =>
              prev.map((item) => (item.key === feed.key ? { ...item, volume } : item))
            )
          }
          onRemove={() => setFeeds((prev) => prev.filter((item) => item.key !== feed.key))}
        />
      ))}
      <a href="https://www.liveatc.net/search/?icao=KAUS" target="_blank" rel="noopener noreferrer">
        Find feeds on LiveATC
      </a>
    </section>
  );
}
