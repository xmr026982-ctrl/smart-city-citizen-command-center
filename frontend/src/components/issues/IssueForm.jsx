import { useState } from "react";

function IssueForm() {
  const [formData, setFormData] = useState({
    title: "",
    category: "",
    description: "",
    location: "",
  });

  const [submitted, setSubmitted] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((previousData) => ({
      ...previousData,
      [name]: value,
    }));

    setSubmitted(false);
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    setSubmitted(true);

    console.log("Issue report:", formData);
  };

  return (
    <form className="issue-form" onSubmit={handleSubmit}>
      <div className="issue-form-grid">
        <div className="issue-field">
          <label htmlFor="title">
            Issue title <span>*</span>
          </label>

          <input
            id="title"
            name="title"
            type="text"
            placeholder="Example: Broken streetlight near the park"
            value={formData.title}
            onChange={handleChange}
            required
          />
        </div>

        <div className="issue-field">
          <label htmlFor="category">
            Issue category <span>*</span>
          </label>

          <select
            id="category"
            name="category"
            value={formData.category}
            onChange={handleChange}
            required
          >
            <option value="">Select a category</option>
            <option value="Roads & Traffic">Roads & Traffic</option>
            <option value="Street Lighting">Street Lighting</option>
            <option value="Water Supply">Water Supply</option>
            <option value="Waste Management">
              Waste Management
            </option>
            <option value="Electricity">Electricity</option>
            <option value="Public Safety">Public Safety</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <div className="issue-field issue-field-full">
          <label htmlFor="location">
            Issue location <span>*</span>
          </label>

          <input
            id="location"
            name="location"
            type="text"
            placeholder="Enter the area, street, landmark, or address"
            value={formData.location}
            onChange={handleChange}
            required
          />
        </div>

        <div className="issue-field issue-field-full">
          <label htmlFor="description">
            Describe the issue <span>*</span>
          </label>

          <textarea
            id="description"
            name="description"
            rows="6"
            placeholder="Explain what happened and how it is affecting the area..."
            value={formData.description}
            onChange={handleChange}
            required
          ></textarea>

          <small>
            Add useful details so the concerned department can
            understand the problem clearly.
          </small>
        </div>
      </div>

      <div className="issue-form-footer">
        <p>
          <span>*</span> Required fields
        </p>

        <button type="submit" className="issue-submit-button">
          Submit report
          <span>↗</span>
        </button>
      </div>

      {submitted && (
        <div className="issue-form-success" role="status">
          Your report has been prepared successfully.
          <br />
          Photo upload and backend submission will be connected next.
        </div>
      )}
    </form>
  );
}

export default IssueForm;