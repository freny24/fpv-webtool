# Quick Demo Script for Wednesday Meeting with Aline

---

## **Opening Statement (30 seconds)**

"Hi Aline! I've made two major improvements to make the FPV tool more powerful. Let me walk you through them."

---

## **Demo 1: User Contribution Feature (2-3 minutes)**

### **Setup:**
Point to the top-right corner where you added the button.

### **Script:**

**"First, we added a way for community members to submit floating solar sites they know about."**

**Step 1:** Click the **"Contribute a Site"** button (top right)

**"This opens a form where anyone can report a new site."**

**Step 2:** Point out the form fields:
- *"They enter the GPS coordinates - latitude and longitude"*
- *"Optional details like site name and country"*
- *"Most importantly, a SOURCE - where did they learn about this site?"*
  - Show the dropdown options: "Field visit, News article, Satellite imagery, Local knowledge, Company website, Other"
- *"And notes - any extra information to help us verify"*

**Step 3:** Explain the workflow:
- *"When they submit, it goes to your review queue"*
- *"We have duplicate detection - if it's close to an existing site, we flag it"*
- *"Once you approve it, it appears on the map as a green marker"*

**"This turns the map into a crowdsourced database instead of something static. People on the ground can help us discover sites we missed."**

---

## **Demo 2: Climate Zones Feature (2-3 minutes)**

### **Setup:**
Navigate to the search box (top left)

### **Script:**

**"Second feature: climate zones. Each floating solar site now knows what climate it's in."**

**Step 1:** In the search box, type: **"tropical"** (or any climate like "temperate", "arid", "cold")

**"See how it shows climate results? Let me click this one..."**

**Step 2:** Click the climate result

**"Watch what happens..."**
- Map zooms in
- Shows only sites in that climate
- Banner appears at top showing the filter: "Showing 47 Tropical FPV sites"

**Step 3:** Explain what you see on the map:
- *"Each site has a colored ring around it - the color represents its climate zone"*
- *"Tropical = one color, Temperate = different color, etc."*
- *"This is based on Köppen climate classification - a scientific standard"*

**"Why does this matter?"**
- *"Researchers can study how floating solar performs in different climates"*
- *"We can see if certain climates have more/fewer installations"*
- *"It helps answer: does climate affect solar efficiency?"*

**Step 4:** Clear the filter
- Click **"Clear"** button on the banner to show all sites again

---

## **Summary Slide (1 minute)**

**"So in summary, I've added two key capabilities:**

1. **Community Contributions** - Users can submit new sites, which appear as green markers after you review them
2. **Climate Zone Intelligence** - Every site is classified by climate, so you can search and filter by climate type

**"This makes the tool more comprehensive and more scientific. Any features you'd like me to add or modify?"**

---

## **Talking Points (If she asks questions)**

### **Q: "Can anyone contribute, or do they need an account?"**
A: "Currently anyone can submit. We could add account/authentication if you'd like, but community input is probably better without barriers."

### **Q: "How do we prevent spam contributions?"**
A: "Your review process catches everything. Plus our duplicate detection flags suspicious submissions. You have full control."

### **Q: "What's Köppen classification?"**
A: "It's a scientific system for classifying world climates based on temperature and rainfall. Like 'Tropical Wet', 'Temperate Continental', etc. We use this standard so our data is scientifically consistent."

### **Q: "How do we know the coordinates are accurate?"**
A: "Users provide them, but satellite imagery and our verification process during review catches bad data. Community input with verification is more accurate than our data alone."

### **Q: "Can we change the colors for climate zones?"**
A: "Yes! That's in the code and customizable. We can tweak the colors for better visual clarity if you want."

### **Q: "What if someone submits a duplicate?"**
A: "Our system flags it, but still sends it to you for review. You make the final call - approve or reject."

---

## **Technical Terms to Drop (if needed)**

If Aline wants more technical details:

- **Modal** = the popup form that appears over the map
- **Marker** = the pin/dot on the map for each site
- **GeoJSON** = geographic data format (used for country borders)
- **Leaflet** = the mapping library we use
- **API** = the backend system that stores submissions and serves data
- **State** = data that updates the UI when it changes
- **Component** = a reusable piece of UI code

*But try to avoid these unless she asks!*

---

## **Visual Aids for Conversation**

Draw or point to these if helpful:

```
OLD WAY:
FPV Data → Fixed Map Display → No updates

NEW WAY:
FPV Data + Community Submissions → Dynamic Map → Climate Filtering
```

---

## **Closing Questions for Aline**

1. "Do you want to adjust the contribution form - add or remove any fields?"
2. "Should we add more climate-based features?"
3. "Any changes to the review workflow you'd like?"
4. "Should we display contributor information or keep it anonymous?"

---

## **Demo Checklist**

- [ ] Test "Contribute a Site" button opens
- [ ] Test search for climate zone (type "tropical" or "temperate")
- [ ] Test clicking climate result filters map
- [ ] Test "Clear" button removes filter
- [ ] Show green marker on map (community submission)
- [ ] Show climate zone color on FPV markers
- [ ] Test Admin panel (she might ask what that is)

