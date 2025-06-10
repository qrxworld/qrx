# **QRx.world**

### **A decentralized, browser-based operating system.**

## **Features**

* Boots from a QR Code.  
* Private, in-browser filesystem (IndexedDB).  
* Integrated AI for data analysis.  
* Local-first Git versioning of the filesystem.

## **Examples**

```sh
# Create a directory and change into it:  
mkdir /thoughts/2025-06-09 && cd /thoughts/2025-06-09

# Write a thought to a file:  
echo "The metaverse is not a destination, it is an operating system." \> realization.md

# Summon the AI to reflect:  
cat realization.md | ai reflect \--depth=3

# Commit the moment to your timeline:  
git commit \-a \-m "Realization: The nature of the metaverse."
```

## **Dependencies**

* [**xterm.js**](https://xtermjs.org/): The portal.  
* [**isomorphic-git**](https://isomorphic-git.org/): Local-first versioning.  
* [**Nearley.js**](https://nearley.js.org/): Shell command parser.  
* [**LightningFS**](https://github.com/isomorphic-git/lightning-fs): Filesystem foundation.

## **Inspiration**

* **Plan 9 from Bell Labs:** The 'everything is a file' philosophy.  
* **jor1k:** Proved the browser can be a true operating system.
