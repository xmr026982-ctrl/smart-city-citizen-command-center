import { useEffect, useState } from 'react'

const issues = [
  {
    type: 'Pothole',
    location: 'Main Street',
    status: 'In Progress',
    color: '#ef4444',
    icon: '🚧'
  },
  {
    type: 'Garbage',
    location: 'Riverside Park',
    status: 'Pending',
    color: '#f59e0b',
    icon: '🗑️'
  },
  {
    type: 'Streetlight',
    location: 'Oak Avenue',
    status: 'Solved',
    color: '#3b82f6',
    icon: '💡'
  }
]

const featureCards = [
  {
    icon: '🚨',
    title: 'Issue Solving',
    text: 'Report civic problems and follow them from the first report to the final fix.'
  },
  {
    icon: '🗳️',
    title: 'Community Voting',
    text: 'Give residents a voice and help your community prioritize what matters most.'
  },
  {
    icon: '📍',
    title: 'Live Locations',
    text: 'See reported problems on an easy-to-understand city map.'
  },
  {
    icon: '📊',
    title: 'Problem Status',
    text: 'Track every issue as it moves from pending to in progress and solved.'
  }
]

function PlatformPreview({ onNavigate }) {
  const [activeIssue, setActiveIssue] =
    useState(0)

  const [resolvedIssues, setResolvedIssues] =
    useState(0)

  const issue = issues[activeIssue]

  useEffect(() => {
    const target = 2847
    const duration = 1200
    const startedAt = performance.now()

    const updateCount = (now) => {
      const progress = Math.min(
        (now - startedAt) / duration,
        1
      )

      setResolvedIssues(
        Math.floor(progress * target)
      )

      if (progress < 1) {
        requestAnimationFrame(updateCount)
      }
    }

    requestAnimationFrame(updateCount)
  }, [])

  return (
    <main className="app preview-page">

    

      <nav className="nav preview-nav">

        <button
          className="brand brand-button"
          onClick={() =>
            onNavigate('home')
          }
        >
          <span className="brand-mark">
            ✦
          </span>

          <span>
            Smart<span>City</span>
          </span>
        </button>

        <div className="nav-actions">

          <button
            className="text-button"
            onClick={() =>
              document
                .getElementById('features')
                ?.scrollIntoView({
                  behavior: 'smooth'
                })
            }
          >
            Features
          </button>

          <button
            className="text-button"
            onClick={() =>
              onNavigate('home')
            }
          >
            Home
          </button>

        </div>

      </nav>



      <section className="preview-hero">

        <div>

          <p className="eyebrow">
            SMARTCITY PLATFORM
          </p>

          <h1>
            Make your city
            <br />
            <em>better together.</em>
          </h1>

          <p className="hero-copy">
            A simple, transparent way for
            citizens and city teams to find
            problems, work together, and
            create lasting change.
          </p>

        </div>

        <div className="hero-stat">

          <strong>
            {resolvedIssues.toLocaleString()}
          </strong>

          <span>
            issues resolved
            <br />
            this month
          </span>

        </div>

      </section>


      <section className="dashboard-grid">

        <div className="map-card card">

          <div className="card-heading">

            <div>

              <p className="label">
                LIVE CITY MAP
              </p>

              <h2>
                Problem locations
              </h2>

            </div>

            <span className="live-pill">
              <i />
              Live
            </span>

          </div>

          <div className="map">

            <div className="map-label label-one">
              NORTH DISTRICT
            </div>

            <div className="map-label label-two">
              RIVERSIDE
            </div>

            <div className="road road-a" />
            <div className="road road-b" />
            <div className="road road-c" />
            <div className="road road-d" />

            <div className="map-toolbar">

              <span className="map-live">
                <i />
                LIVE UPDATES
              </span>

              <button aria-label="Zoom in">
                +
              </button>

              <button aria-label="Zoom out">
                −
              </button>

            </div>

            <div className="map-summary">

              <strong>
                128
              </strong>

              <span>
                reported issues
                <br />
                in your city
              </span>

            </div>

            {issues.map((item, index) => (

              <button
                key={item.type}
                className={`map-pin pin-${
                  index + 1
                } ${
                  activeIssue === index
                    ? 'selected'
                    : ''
                }`}
                style={{
                  '--pin-color': item.color
                }}
                onClick={() =>
                  setActiveIssue(index)
                }
                aria-label={`Show ${item.type} issue`}
              >
                <span>●</span>
              </button>

            ))}

            <div
              className="selected-issue"
              style={{
                '--issue-color': issue.color
              }}
            >

              <span className="selected-icon">
                {issue.icon}
              </span>

              <div>

                <strong>
                  {issue.type}
                </strong>

                <small>
                  {issue.location} ·{' '}
                  <b>
                    {issue.status}
                  </b>
                </small>

              </div>

              <span className="selected-arrow">
                →
              </span>

            </div>

            <div className="map-legend">

              <span>
                <i
                  style={{
                    background: '#ef4444'
                  }}
                />
                Pothole
              </span>

              <span>
                <i
                  style={{
                    background: '#f59e0b'
                  }}
                />
                Garbage
              </span>

              <span>
                <i
                  style={{
                    background: '#3b82f6'
                  }}
                />
                Streetlight
              </span>

            </div>

          </div>

        </div>

      </section>

    
      <section
        id="features"
        className="section-heading"
      >

        <p className="eyebrow">
          SMARTCITY FEATURES
        </p>

        <h2>
          Everything your community needs.
        </h2>

        <p>
          Simple tools that help citizens
          speak up, stay informed, and
          work together.
        </p>

      </section>

      <section className="feature-grid feature-grid-large">

        {featureCards.map((feature) => (

          <article
            className="feature-card"
            key={feature.title}
          >

            <span className="feature-icon">
              {feature.icon}
            </span>

            <h3>
              {feature.title}
            </h3>

            <p>
              {feature.text}
            </p>

           

          </article>

        ))}

      </section>

      

      <section className="extra-grid">

        <div>

          <p className="eyebrow">
            MORE THAN REPORTS
          </p>

          <h2>
            See the full picture.
          </h2>

          <p>
            Stay informed with air quality
            updates, community priorities,
            and useful city services—all
            designed around your everyday life.
          </p>

        </div>

        <div className="mini-tools">

          <div>
            <span>🌿</span>
            <strong>Air quality</strong>
            <small>
              Good · 42 AQI
            </small>
          </div>

          <div>
            <span>📣</span>
            <strong>City updates</strong>
            <small>
              3 new announcements
            </small>
          </div>

          <div>
            <span>🧭</span>
            <strong>Local services</strong>
            <small>
              Find help nearby
            </small>
          </div>

        </div>

      </section>

     

      <section className="final-cta">

        <p className="eyebrow">
          YOUR CITY. YOUR VOICE.
        </p>

        <h2>
          Ready to make your city better?
        </h2>

        <p>
          Join your neighbors and help
          shape the place you call home.
        </p>

        <div>

          <button
  className="create-account-btn"
  onClick={() => onNavigate('signup')}
>
  Create an account
</button>

          <button
            className="outline-button light"
            onClick={() =>
              onNavigate('auth')
            }
          >
            Log in
          </button>

        </div>

      </section>

    </main>
  )
}

export default PlatformPreview