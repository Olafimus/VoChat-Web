import React from "react";

const ContactScreen = () => {
  const dummyContacts = [
    { name: "Shabnam", id: "aFAkjfa3" },
    { name: "Horst", id: "cfaejfa3" },
    { name: "Barbara", id: "dfaejfsad" },
    { name: "Pascal", id: "AsfWal4L3A" },
    { name: "Marco", id: "ffwaSel4L3A" },
  ];

  return (
    <main>
      <header className="contacts-header">Contacts</header>
      <div className="contacts-list">
        {dummyContacts.map((contact) => (
          <div key={contact.id} className="contact-list-item">
            <p>{contact.name}</p>
          </div>
        ))}
      </div>
    </main>
  );
};

export default ContactScreen;
