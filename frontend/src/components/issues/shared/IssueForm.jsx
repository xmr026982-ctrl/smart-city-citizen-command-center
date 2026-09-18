import { useState, useRef } from "react";

function IssueForm() {
  const [formData, setFormData] = useState({
    title: "",
    category: "",
    description: "",
    location: "",
  });

  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);

  // Refs so we can focus the first invalid field
  const titleRef = useRef(null);
  const categoryRef = useRef(null);
  const locationRef = useRef(null);
  const descriptionRef = useRef(null);

  const fieldRefs = {
    title: titleRef,
    category: categoryRef,
    location: locationRef,
    description: descriptionRef,
  };

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Clear the error for this field as soon as the user types
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }

    setSubmitted(false);
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    const newErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = "Please fill this required field";
    }
    if (!formData.category.trim()) {
      newErrors.category = "Please select a category";
    }
    if (!formData.location.trim()) {
      newErrors.location = "Please fill this required field";
    }
    if (!formData.description.trim()) {
      newErrors.description = "Please fill this required field";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);

      // Focus the first invalid field (premium “redirect” behaviour)
      const firstErrorField = Object.keys(newErrors)[0];
      const ref = fieldRefs[firstErrorField];
      if (ref?.current) {
        ref.current.focus();
        ref.current.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }

    // All good
    setErrors({});
    setSubmitted(true);
    console.log("Issue report:", formData);
  };

  return (
    <form className="issue-form" onSubmit={handleSubmit} noValidate>
      <div className="issue-form-grid">
        {/* Title */}
        <div className="issue-field">
          <label htmlFor="title">
            Issue title <span className="required">*</span>
          </label>
          <input
            ref={titleRef}
            id="title"
            name="title"
            type="text"
            placeholder="Example: Broken streetlight near the park"
            value={formData.title}
            onChange={handleChange}
            className={errors.title ? "has-error" : ""}
          />
          {errors.title && (
            <div className="field-error">{errors.title}</div>
          )}
        </div>

        {/* Category */}
        <div className="issue-field">
          <label htmlFor="category">
            Issue category <span className="required">*</span>
          </label>
          <select
            ref={categoryRef}
            id="category"
            name="category"
            value={formData.category}
            onChange={handleChange}
            className={errors.category ? "has-error" : ""}
          >
            <option value="">Select a category</option>
            <option value="Roads & Traffic">Roads & Traffic</option>
            <option value="Street Lighting">Street Lighting</option>
            <option value="Water Supply">Water Supply</option>
            <option value="Waste Management">Waste Management</option>
            <option value="Electricity">Electricity</option>
            <option value="Public Safety">Public Safety</option>
            <option value="Other">Other</option>
          </select>
          {errors.category && (
            <div className="field-error">{errors.category}</div>
          )}
        </div>

        {/* Location */}
        <div className="issue-field issue-field-full">
          <label htmlFor="location">
            Issue location <span className="required">*</span>
          </label>
          <input
            ref={locationRef}
            id="location"
            name="location"
            type="text"
            placeholder="Enter the area, street, landmark, or address"
            value={formData.location}
            onChange={handleChange}
            className={errors.location ? "has-error" : ""}
          />
          {errors.location && (
            <div className="field-error">{errors.location}</div>
          )}
        </div>

        {/* Description */}
        <div className="issue-field issue-field-full">
          <label htmlFor="description">
            Describe the issue <span className="required">*</span>
          </label>
          <textarea
            ref={descriptionRef}
            id="description"
            name="description"
            rows={7}
            placeholder="Explain what happened and how it is affecting the area..."
            value={formData.description}
            onChange={handleChange}
            className={errors.description ? "has-error" : ""}
          />
          <small>
            Add useful details so the concerned department can understand the
            problem clearly.
          </small>
          {errors.description && (
            <div className="field-error">{errors.description}</div>
          )}
        </div>
      </div>

      <div className="issue-form-footer">
        <p>
          <span className="required">*</span> Required fields
        </p>

        <button type="submit" className="issue-submit-button">
          Submit report <span>↗</span>
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